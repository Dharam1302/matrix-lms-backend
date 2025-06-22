const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "student"], required: true },
  name: { type: String, required: true },
  // Student-specific fields
  department: { 
    type: String, 
    required: function() { return this.role === 'student'; },
    default: function() { return this.role === 'student' ? undefined : 'N/A'; }
  },
  rollNumber: { 
    type: String, 
    required: function() { return this.role === 'student'; },
    unique: function() { return this.role === 'student'; },
    sparse: true // Allows null/undefined for non-students
  },
  batch: { 
    type: String, 
    required: function() { return this.role === 'student'; },
    default: function() { return this.role === 'student' ? undefined : 'N/A'; }
  },
  semester: { 
    type: Number, 
    min: 1,
    max: 8,
    required: function() { return this.role === 'student'; }
  },
  section: { 
    type: String, 
    required: function() { return this.role === 'student'; },
    default: function() { return this.role === 'student' ? undefined : 'N/A'; }
  },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

UserSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Virtual for full student ID (department + roll number)
UserSchema.virtual('studentId').get(function() {
  if (this.role !== 'student') return null;
  return `${this.department}${this.rollNumber}`;
});

// Ensure virtuals are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", UserSchema);
