const User = require('../models/User');
const asyncHandler = require('express-async-handler');

const getStudentByRollNumber = asyncHandler(async (req, res) => {
  const { rollNumber } = req.params;
  const student = await User.findOne({ rollNumber, role: 'student' });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(student);
});

const getCurrentStudent = asyncHandler(async (req, res) => {
  const student = await User.findById(req.user._id).select('-password');
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(student);
});

const updateCurrentStudent = asyncHandler(async (req, res) => {
  const { name, department, batch } = req.body;
  
  const student = await User.findById(req.user._id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  // Only allow updating certain fields
  if (name) student.name = name;
  if (department) student.department = department;
  if (batch) student.batch = batch;

  const updatedStudent = await student.save();
  res.json(updatedStudent);
});

module.exports = { 
  getStudentByRollNumber,
  getCurrentStudent,
  updateCurrentStudent
};