const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    sNo: { type: String, required: true, unique: true },
    rollNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    branch: { type: String, required: true },
    college: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    year: { type: String, enum: ["1st", "2nd", "3rd", "4th"], required: true },
  },
  { timestamps: true }
);

StudentSchema.index({ rollNumber: 1, email: 1 });

module.exports = mongoose.model("Student", StudentSchema);
