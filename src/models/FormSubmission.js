const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema({
  formType: {
    type: String,
    required: [true, 'Form type is required'],
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
  },
  department: {
    type: String,
    default: 'Unknown',
  },
  rollNumber: {
    type: String,
  },
  formData: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Form data is required'],
  },
  status: {
    type: String,
    enum: ['New', 'In Review', 'Resolved', 'Denied'],
    default: 'New',
  },
  adminComment: {
    type: String,
  },
  submittedOn: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Update lastUpdated timestamp before saving
formSubmissionSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Ensure submittedBy is populated when querying
formSubmissionSchema.pre(/^find/, function(next) {
  this.populate('submittedBy', 'name email rollNumber department');
  next();
});

module.exports = mongoose.model('FormSubmission', formSubmissionSchema); 