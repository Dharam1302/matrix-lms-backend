const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., "Added", "Status Updated"
  by: { type: String, required: true }, // e.g., "Librarian"
  date: { type: Date, default: Date.now },
  details: { type: String },
});

const bookSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true }, // e.g., "B<timestamp>-<isbn>", "J<timestamp>-<isnn>"
  title: { type: String, required: true },
  author: { type: String, default: 'Unknown Author' },
  isbn: { type: String }, // For books
  isnn: { type: String }, // For journals
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Available', 'Out of Stock', 'In Repair', 'Archived', 'Lost'],
    default: 'Available',
  },
  copies: { type: Number, default: 1 },
  available: { type: Number, default: 1 },
  coverImage: { type: String, default: '' },
  publisher: { type: String, default: 'Unknown Publisher' },
  publishedDate: { type: String, default: '' },
  pageCount: { type: Number, default: 0 },
  language: { type: String, default: 'en' },
  categories: [{ type: String }],
  addedDate: { type: Date, default: Date.now },
  addedBy: { type: String, default: 'Librarian' },
  timesLoaned: { type: Number, default: 0 },
  rack: { type: String, default: 'N/A' },
  lastBorrowed: { type: String, default: 'N/A' },
  auditTrail: [auditTrailSchema],
  toc: { type: mongoose.Mixed }, // For table of contents (array or string)
  type: { type: String, enum: ['book', 'journal'], default: 'book' }, // Distinguish books vs journals
});

module.exports = mongoose.model('Book', bookSchema);