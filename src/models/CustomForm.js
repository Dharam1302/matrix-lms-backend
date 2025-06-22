const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Field name is required'],
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'date', 'select', 'file'],
    required: [true, 'Field type is required'],
  },
  required: {
    type: Boolean,
    default: false,
  },
  options: {
    type: String, // For select fields, comma-separated options
  },
}, { _id: false });

const customFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Form name is required'],
    unique: true,
  },
  description: {
    type: String,
  },
  fields: {
    type: [fieldSchema],
    required: [true, 'At least one field is required'],
    validate: {
      validator: function(fields) {
        return fields.length > 0;
      },
      message: 'Form must have at least one field',
    },
  },
  requireAuth: {
    type: Boolean,
    default: true,
  },
  emailNotification: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator reference is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Update updatedAt timestamp before saving
customFormSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CustomForm', customFormSchema); 