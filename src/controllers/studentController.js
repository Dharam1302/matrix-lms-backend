const Student = require('../models/Student');
const asyncHandler = require('express-async-handler');

const getStudentByRollNumber = asyncHandler(async (req, res) => {
  const { rollNumber } = req.params;
  const student = await Student.findOne({ rollNumber });
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.json(student);
});

module.exports = { getStudentByRollNumber };