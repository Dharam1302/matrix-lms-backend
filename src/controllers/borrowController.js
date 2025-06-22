const BorrowRecord = require('../models/borrowRecord');
const Book = require('../models/Book');
const User = require('../models/User');
const AppError = require('../utils/appError');
const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');

const LIBRARY_CONFIG = {
  MAX_BOOKS_PER_STUDENT: 4,
  DEFAULT_GRACE_PERIOD: 7,
  DEFAULT_FINE_RATE: 1,
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
  const { dueDate, status, notes } = req.body;

  const record = await BorrowRecord.findById(id);
  if (!record) return next(new AppError('Borrow record not found', 404));
  if (record.status === 'Returned') return next(new AppError('Cannot update returned record', 400));

  const fine = dueDate ? calculateFine(dueDate) : record.fine;
  const updatedRecord = await BorrowRecord.findByIdAndUpdate(id, {
    dueDate: dueDate || record.dueDate,
    status: status || record.status,
    fine,
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