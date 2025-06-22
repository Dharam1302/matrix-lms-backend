const mongoose = require('mongoose');

const borrowRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A borrow record must have a student'],
  },
  book: {
    type: String, // Reference Book by id (e.g., B<timestamp>-<isbn>)
    required: [true, 'A borrow record must have a book'],
  },
  borrowDate: {
    type: Date,
    required: [true, 'A borrow record must have a borrow date'],
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: [true, 'A borrow record must have a due date'],
  },
  returnDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['Borrowed', 'Overdue', 'Returned'],
    default: 'Borrowed',
  },
  fine: {
    type: Number,
    default: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Waived', null],
    default: null,
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'upi', 'card', null],
    default: null,
  },
  conditionAtIssue: {
    type: String,
    enum: ['New', 'Good', 'Used', 'Damaged'],
    default: 'New',
  },
  notes: {
    type: String,
    trim: true,
  },
  issuedBy: {
    type: String,
    required: [true, 'A borrow record must specify the issuer'],
  },
  adminAction: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Populate student field with user details (book is populated manually in controller due to string ID)
borrowRecordSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'student',
    select: 'name email rollNumber department',
  });
  next();
});

// Indexes for performance
borrowRecordSchema.index({ student: 1, status: 1 });
borrowRecordSchema.index({ book: 1, status: 1 });
borrowRecordSchema.index({ borrowDate: 1 });

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);