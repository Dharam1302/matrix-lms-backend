const express = require('express');
const router = express.Router();
const { 
  getStudentByRollNumber,
  getCurrentStudent,
  updateCurrentStudent
} = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

// Admin routes
router.get('/:rollNumber', authMiddleware, restrictTo(['admin']), getStudentByRollNumber);

// Student routes
router.get('/profile/me', authMiddleware, restrictTo(['student']), getCurrentStudent);
router.put('/profile/me', authMiddleware, restrictTo(['student']), updateCurrentStudent);

module.exports = router;