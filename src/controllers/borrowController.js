const BorrowRecord = require('../models/borrowRecord');
const Book = require('../models/Book');
const User = require('../models/User');
const AppError = require('../utils/appError');
const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const { sendEmail } = require('../config/nodemailer');

const LIBRARY_CONFIG = {
  MAX_BOOKS_PER_STUDENT: 4,
  DEFAULT_GRACE_PERIOD: 7,
  DEFAULT_FINE_RATE: 1,
  MAX_EXTENSION_DAYS: 7
};

// Calculate fine based on overdue days
const calculateFine = (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);
  const daysOverdue = Math.floor((today - due) / (24 * 60 * 60 * 1000)) - LIBRARY_CONFIG.DEFAULT_GRACE_PERIOD;
  return daysOverdue > 0 ? daysOverdue * LIBRARY_CONFIG.DEFAULT_FINE_RATE : 0;
};

// Get all borrow records (Admin)
exports.getAllBorrowRecords = asyncHandler(async (req, res, next) => {
  let records = await BorrowRecord.find();
  // Manually populate book field
  records = await Promise.all(records.map(async (record) => {
    const book = await Book.findOne({ id: record.book }).select('title isbn categories available status rack type timesLoaned');
    return { ...record.toObject(), book };
  }));
  res.status(200).json({
    status: 'success',
    results: records.length,
    data: { records },
  });
});

// Get student's borrow history
exports.getStudentBorrowHistory = asyncHandler(async (req, res, next) => {
  const records = await BorrowRecord.find({ student: req.user._id });
  // Manually populate book field
  const populatedRecords = await Promise.all(records.map(async (record) => {
    const book = await Book.findOne({ id: record.book }).select('title isbn categories available status rack type timesLoaned');
    return { ...record.toObject(), book };
  }));
  res.status(200).json({
    status: 'success',
    results: records.length,
    data: { records: populatedRecords },
  });
});

// Get specific student's borrow history (Admin)
exports.getStudentBorrowHistoryByAdmin = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  
  const student = await User.findById(studentId);
  if (!student) return next(new AppError('Student not found', 404));
  if (student.role !== 'student') return next(new AppError('Selected user is not a student', 400));

  const records = await BorrowRecord.find({ student: studentId });
  // Manually populate book field
  const populatedRecords = await Promise.all(records.map(async (record) => {
    const book = await Book.findOne({ id: record.book }).select('title isbn categories available status rack type timesLoaned');
    return { ...record.toObject(), book };
  }));

  res.status(200).json({
    status: 'success',
    results: records.length,
    data: { records: populatedRecords },
  });
});

// Borrow a book (Admin)
exports.borrowBook = asyncHandler(async (req, res, next) => {
  const { studentId, bookId, dueDate, conditionAtIssue, notes } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await User.findById(studentId).session(session);
    if (!student) return next(new AppError('Student not found', 404));
    if (student.role !== 'student') return next(new AppError('Selected user is not a student', 400));

    const book = await Book.findOne({ id: bookId }).session(session);
    if (!book) return next(new AppError('Book not found', 404));
    if (book.available <= 0) return next(new AppError('No copies available', 400));
    if (book.status !== 'Available') return next(new AppError(`Book is ${book.status.toLowerCase()} and cannot be borrowed`, 400));

    const currentBooks = await BorrowRecord.countDocuments({
      student: studentId,
      status: { $ne: 'Returned' },
    }).session(session);
    if (currentBooks >= LIBRARY_CONFIG.MAX_BOOKS_PER_STUDENT) {
      return next(new AppError(`Maximum borrow limit reached. Students can only borrow up to ${LIBRARY_CONFIG.MAX_BOOKS_PER_STUDENT} books at a time.`, 400));
    }

    const borrowRecord = await BorrowRecord.create([{
      student: studentId,
      book: bookId,
      dueDate,
      conditionAtIssue: conditionAtIssue || 'New',
      notes,
      issuedBy: req.user.name,
      adminAction: `Issued by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
    }], { session });

    await Book.findOneAndUpdate({ id: bookId }, {
      $inc: { available: -1, timesLoaned: 1 },
      lastBorrowed: new Date().toISOString().split('T')[0],
      $push: {
        auditTrail: {
          action: 'Borrowed',
          by: req.user.name,
          details: `Borrowed by ${student.name}`,
        },
      },
    }, { session });

    await session.commitTransaction();
    // Populate book for response
    const record = { ...borrowRecord[0].toObject(), book: await Book.findOne({ id: bookId }).select('title isbn categories available status rack type timesLoaned') };
    res.status(201).json({
      status: 'success',
      data: { record },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Return a book (Admin)
exports.returnBook = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { returnCondition, returnNotes } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const record = await BorrowRecord.findById(id).session(session);
    if (!record) return next(new AppError('Borrow record not found', 404));
    if (record.status === 'Returned') return next(new AppError('Book already returned', 400));

    const book = await Book.findOne({ id: record.book }).session(session);
    if (!book) return next(new AppError('Book not found', 404));

    const fine = calculateFine(record.dueDate);
    const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
      status: 'Returned',
      returnDate: new Date(),
      fine,
      paymentStatus: fine > 0 ? 'Pending' : null,
      returnCondition,
      returnNotes,
      adminAction: `Returned by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
    }, { new: true, session });

    await Book.findOneAndUpdate({ id: record.book }, {
      $inc: { available: 1 },
      $push: {
        auditTrail: {
          action: 'Returned',
          by: req.user.name,
          details: `Returned by ${record.student.name}`,
        },
      },
    }, { session });

    await session.commitTransaction();
    // Populate book for response
    const finalRecord = { ...updatedRecord.toObject(), book: await Book.findOne({ id: record.book }).select('title isbn categories available status rack type timesLoaned') };
    res.status(200).json({
      status: 'success',
      data: { record: finalRecord },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Update borrow record (Admin)
exports.updateBorrowRecord = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { dueDate, status, notes, fine, paymentStatus } = req.body;

  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));
  if (record.status === 'Returned') return next(new AppError('Cannot update returned record', 400));

  const updatedFine = fine !== undefined ? fine : record.fine;
  const updatedPaymentStatus = fine !== undefined ? (paymentStatus || 'Pending') : record.paymentStatus;

  const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
    dueDate: dueDate || record.dueDate,
    status: status || record.status,
    fine: updatedFine,
    paymentStatus: updatedPaymentStatus,
    notes,
    adminAction: `Updated by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  }, { new: true });

  await Book.findOneAndUpdate({ id: record.book }, {
    $push: {
      auditTrail: {
        action: 'Updated',
        by: req.user.name,
        details: `Borrow record updated`,
      },
    },
  });

  // Populate book for response
  const finalRecord = { ...updatedRecord.toObject(), book: await Book.findOne({ id: record.book }).select('title isbn categories available status rack type') };
  res.status(200).json({
    status: 'success',
    data: { record: finalRecord },
  });
});

// Send reminder (Admin)
exports.sendReminder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));

  // Stub for email sending
  console.log(`Reminder sent to ${record.student.name} for book ${record.book.title}`);

  await BorrowRecord.findByIdAndUpdate(id, {
    adminAction: `Reminder sent by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  });

  await Book.findOneAndUpdate({ id: record.book }, {
    $push: {
      auditTrail: {
        action: 'Reminder Sent',
        by: req.user.name,
        details: `Reminder sent to ${record.student.name}`,
      },
    },
  });

  res.status(200).json({
    status: 'success',
    message: 'Reminder sent successfully',
  });
});

// Mark fine as paid (Admin)
exports.markFinePaid = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;

  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));
  if (record.fine <= 0) return next(new AppError('No fine to pay', 400));
  if (record.paymentStatus === 'Paid') return next(new AppError('Fine already paid', 400));
  if (record.paymentStatus === 'Waived') return next(new AppError('Fine already waived', 400));

  const shouldMarkReturned = record.status === 'Overdue' && !record.returnDate;
  const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
    paymentStatus: 'Paid',
    paymentMethod: paymentMethod || 'cash',
    status: shouldMarkReturned ? 'Returned' : record.status,
    returnDate: shouldMarkReturned ? new Date() : record.returnDate,
    adminAction: `Fine marked as Paid by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  }, { new: true });

  if (shouldMarkReturned) {
    await Book.findOneAndUpdate({ id: record.book }, {
      $inc: { available: 1 },
      $push: {
        auditTrail: {
          action: 'Returned',
          by: req.user.name,
          details: `Returned due to fine payment`,
        },
      },
    });
  }

  // Populate book for response
  const finalRecord = { ...updatedRecord.toObject(), book: await Book.findOne({ id: record.book }).select('title isbn categories available status rack type') };
  res.status(200).json({
    status: 'success',
    data: { record: finalRecord },
  });
});

// Waive fine (Admin)
exports.waiveFine = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));
  if (record.fine <= 0) return next(new AppError('No fine to waive', 400));
  if (record.paymentStatus === 'Paid') return next(new AppError('Fine already paid', 400));
  if (record.paymentStatus === 'Waived') return next(new AppError('Fine already waived', 400));

  const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
    fine: 0,
    paymentStatus: 'Waived',
    adminAction: `Fine waived by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  }, { new: true });

  await Book.findOneAndUpdate({ id: record.book }, {
    $push: {
      auditTrail: {
        action: 'Fine Waived',
        by: req.user.name,
        details: `Fine waived for borrow record`,
      },
    },
  });

  // Populate book for response
  const finalRecord = { ...updatedRecord.toObject(), book: await Book.findOne({ id: record.book }).select('title isbn categories available status rack type') };
  res.status(200).json({
    status: 'success',
    data: { record: finalRecord },
  });
});

// Get daily borrowing traffic
exports.getDailyTraffic = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const records = await BorrowRecord.find({
    borrowDate: today
  });

  // Initialize hourly traffic
  const hourlyTraffic = Array(24).fill(0);
  
  // Count borrows per hour
  records.forEach(record => {
    const hour = new Date(record.borrowDate).getHours();
    hourlyTraffic[hour]++;
  });

  res.status(200).json({
    status: 'success',
    data: hourlyTraffic
  });
});

// Get admin analytics
exports.getAdminAnalytics = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Get total books
  const totalBooks = await Book.countDocuments();

  // Get active members from scanner logs
  const activeMembers = await ActivityLog.countDocuments({
    date: today,
    timeOut: null,
    status: 'Checked In'
  });

  // Get active borrows and overdue books
  const borrowRecords = await BorrowRecord.find();
  const now = new Date();
  const activeAndOverdue = borrowRecords.reduce((acc, record) => {
    if (!record.returnDate) { // Book is still borrowed
      acc.active++;
      if (new Date(record.dueDate) < now) {
        acc.overdue++;
      }
    }
    return acc;
  }, { active: 0, overdue: 0 });

  // Get daily traffic
  const dailyTraffic = await BorrowRecord.aggregate([
    {
      $match: {
        borrowDate: today
      }
    },
    {
      $group: {
        _id: { $hour: { $toDate: "$borrowDate" } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Initialize 24-hour array with zeros
  const hourlyTraffic = Array(24).fill(0);
  dailyTraffic.forEach(item => {
    hourlyTraffic[item._id] = item.count;
  });

  // Get activity logs for time spent calculation
  const activityLogs = await ActivityLog.find({
    date: { $gte: thirtyDaysAgoStr },
    status: 'Checked Out'
  });

  // Calculate time spent per student from activity logs
  const studentTimeSpent = {};
  activityLogs.forEach(log => {
    const timeIn = new Date(`${log.date} ${log.timeIn}`);
    const timeOut = new Date(`${log.date} ${log.timeOut}`);
    const timeSpentMinutes = Math.round((timeOut - timeIn) / (1000 * 60));
    
    if (!studentTimeSpent[log.rollNumber]) {
      studentTimeSpent[log.rollNumber] = {
        totalMinutes: 0,
        visits: 0
      };
    }
    studentTimeSpent[log.rollNumber].totalMinutes += timeSpentMinutes;
    studentTimeSpent[log.rollNumber].visits++;
  });

  // Create leaderboard with only hours spent
  const leaderboardData = [];
  for (const [rollNumber, timeData] of Object.entries(studentTimeSpent)) {
    const student = await User.findOne({ rollNumber }).select('name rollNumber branch');
    if (student) {
      const totalHours = Math.floor(timeData.totalMinutes / 60);
      if (totalHours >= 1) { // Only include students with at least 1 hour
        leaderboardData.push({
          _id: student._id,
          student: {
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branch
          },
          totalHours: totalHours
        });
      }
    }
  }

  // Sort leaderboard by hours spent
  const sortedLeaderboard = leaderboardData.sort((a, b) => b.totalHours - a.totalHours);

  // Calculate issues and returns
  const issuesAndReturns = borrowRecords.reduce((acc, record) => {
    acc.issued++;
    if (record.returnDate) {
      acc.returned++;
      if (record.fine > 0 && record.paymentStatus === 'Paid') {
        acc.fines += record.fine;
      }
    }
    return acc;
  }, { issued: 0, returned: 0, fines: 0 });

  // Get previous period data for trends
  const prevPeriodStart = new Date(thirtyDaysAgo);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - 30);
  const prevPeriodStartStr = prevPeriodStart.toISOString().split('T')[0];

  const prevPeriodRecords = await BorrowRecord.find({
    borrowDate: { $gte: prevPeriodStartStr, $lt: thirtyDaysAgoStr }
  });

  const prevPeriodStats = prevPeriodRecords.reduce((acc, record) => {
    acc.booksBorrowed++;
    if (!record.returnDate && new Date(record.dueDate) < thirtyDaysAgo) {
      acc.overdueBooks++;
    }
    return acc;
  }, { booksBorrowed: 0, overdueBooks: 0 });

  const prevPeriodActiveMembers = await ActivityLog.countDocuments({
    date: prevPeriodStartStr,
    timeOut: null,
    status: 'Checked In'
  });

  const calculateTrend = (current, previous) => {
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
  };

  res.status(200).json({
    status: 'success',
    data: {
      totalBooks,
      totalBooksTrend: calculateTrend(totalBooks, prevPeriodStats.totalBooks || 0),
      activeMembers,
      activeMembersTrend: calculateTrend(activeMembers, prevPeriodActiveMembers),
      booksBorrowed: activeAndOverdue.active,
      booksBorrowedTrend: calculateTrend(activeAndOverdue.active, prevPeriodStats.booksBorrowed),
      overdueBooks: activeAndOverdue.overdue,
      overdueBooksTrend: calculateTrend(activeAndOverdue.overdue, prevPeriodStats.overdueBooks),
      totalIssued: issuesAndReturns.issued,
      totalReturned: issuesAndReturns.returned,
      totalFines: issuesAndReturns.fines,
      dailyTraffic: hourlyTraffic,
      leaderboard: sortedLeaderboard
    }
  });
});

// Send email notification
exports.sendEmailNotification = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { type } = req.body;
  
  const record = await BorrowRecord.findById(id).populate('student');
  if (!record) return next(new AppError('Borrow record not found', 404));

  const book = await Book.findOne({ id: record.book });
  if (!book) return next(new AppError('Book not found', 404));

  let emailContent;
  let subject;

  if (type === 'fine') {
    subject = 'Library Fine Reminder';
    emailContent = `
      <h2>Library Fine Reminder</h2>
      <p>Dear ${record.student.name},</p>
      <p>This is a reminder about the pending fine on your library account:</p>
      <ul>
        <li><strong>Book Title:</strong> ${book.title}</li>
        <li><strong>Fine Amount:</strong> ₹${record.fine}</li>
        <li><strong>Status:</strong> ${record.status}</li>
      </ul>
      <p>Please clear your dues at the earliest to avoid any service restrictions.</p>
      <p>Thank you for your cooperation.</p>
    `;
  } else {
    // Default due date reminder email
    const dueDate = new Date(record.dueDate).toLocaleDateString('en-IN');
    subject = 'Library Book Due Reminder';
    emailContent = `
      <h2>Library Book Due Reminder</h2>
      <p>Dear ${record.student.name},</p>
      <p>This is a reminder that the following book is due for return:</p>
      <ul>
        <li><strong>Book Title:</strong> ${book.title}</li>
        <li><strong>Due Date:</strong> ${dueDate}</li>
      </ul>
      <p>Please return the book on time to avoid any late fees.</p>
      <p>Thank you for using our library services!</p>
    `;
  }

  const emailSent = await sendEmail(
    record.student.email,
    subject,
    emailContent
  );

  if (!emailSent) {
    return next(new AppError('Failed to send email notification', 500));
  }

  // Update the record to track notification
  await BorrowRecord.findByIdAndUpdate(id, {
    adminAction: `${type === 'fine' ? 'Fine reminder' : 'Due date reminder'} sent by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  });

  res.status(200).json({
    status: 'success',
    message: 'Email notification sent successfully'
  });
});

// Extend borrow period
exports.extendBorrowPeriod = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { dueDate } = req.body;
  
  if (!dueDate) {
    return next(new AppError('New due date is required', 400));
  }

  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));
  
  if (record.status === 'Returned') {
    return next(new AppError('Cannot extend returned book', 400));
  }

  if (record.status === 'Overdue') {
    return next(new AppError('Cannot extend overdue book', 400));
  }

  // Validate that new due date is not more than 7 days from current due date
  const currentDueDate = new Date(record.dueDate);
  const maxAllowedDate = new Date(currentDueDate);
  maxAllowedDate.setDate(maxAllowedDate.getDate() + LIBRARY_CONFIG.MAX_EXTENSION_DAYS);
  
  const newDueDate = new Date(dueDate);
  if (newDueDate > maxAllowedDate) {
    return next(new AppError(`Cannot extend more than ${LIBRARY_CONFIG.MAX_EXTENSION_DAYS} days from current due date`, 400));
  }

  const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
    dueDate: newDueDate,
    adminAction: `Borrow period extended by ${req.user.name} on ${new Date().toLocaleString('en-IN')}`,
  }, { new: true });

  // Send confirmation email
  try {
    const book = await Book.findOne({ id: record.book });
    const student = await User.findById(record.student);

    const emailContent = `
      <h2>Book Due Date Extended</h2>
      <p>Dear ${student.name},</p>
      <p>The due date for your borrowed book has been extended:</p>
      <ul>
        <li><strong>Book Title:</strong> ${book.title}</li>
        <li><strong>New Due Date:</strong> ${newDueDate.toLocaleDateString('en-IN')}</li>
      </ul>
      <p>Thank you for using our library services!</p>
    `;

    await sendEmail(
      student.email,
      'Library Book Due Date Extended',
      emailContent
    );
  } catch (emailError) {
    console.error('Failed to send email notification:', emailError);
    // Continue with the response even if email fails
  }

  // Populate book for response
  const finalRecord = { 
    ...updatedRecord.toObject(), 
    book: await Book.findOne({ id: record.book }).select('title isbn categories available status rack type') 
  };

  res.status(200).json({
    status: 'success',
    data: { record: finalRecord }
  });
});