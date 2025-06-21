const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true },
  name: { type: String, required: true },
  branch: { type: String, required: true },
  section: { type: String, required: true },
  isStudySection: { type: Boolean, default: false },
  timeIn: { type: String, required: true },
  timeOut: { type: String },
  date: { type: String, required: true },
  status: { type: String, enum: ['Checked In', 'Checked Out'], required: true },
  duration: { type: String },
}, { timestamps: true });

ActivityLogSchema.index({ rollNumber: 1, date: 1, section: 1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);