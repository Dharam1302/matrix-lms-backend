const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema({
  formType: { type: String, required: true },
  submittedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  submittedOn: { type: Date, default: Date.now },
  department: { type: String, required: true },
  rollNumber: { type: String }, // Optional, from Student schema
  status: { 
    type: String, 
    enum: ['New', 'In Review', 'Resolved', 'Denied'], 
    default: 'New' 
  },
  formData: { type: Map, of: mongoose.Schema.Types.Mixed }, // Flexible key-value storage
});

module.exports = mongoose.model('FormSubmission', formSubmissionSchema);

const customFormSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fields: [{
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'date', 'email', 'textarea', 'select', 'file'], 
      required: true 
    },
    required: { type: Boolean, default: false },
    options: { type: String } // For select fields
  }],
  requireAuth: { type: Boolean, default: false },
  emailNotification: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CustomForm', customFormSchema);