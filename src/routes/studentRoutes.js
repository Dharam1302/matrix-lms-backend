const express = require('express');
const router = express.Router();
const { getStudentByRollNumber } = require('../controllers/studentController');
const authMiddleware = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

router.get('/:rollNumber', authMiddleware, restrictTo(['admin']), getStudentByRollNumber);

module.exports = router;