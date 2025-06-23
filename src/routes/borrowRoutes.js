const express = require('express');
const borrowController = require('../controllers/borrowController');
const authController = require('../controllers/authController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

const router = express.Router();

// Admin routes
router.use(protect);

router.get('/', restrictTo(['admin']), borrowController.getAllBorrowRecords);
router.post('/borrow', restrictTo(['admin']), borrowController.borrowBook);
router.patch('/:id/return', borrowController.returnBook);
router.patch('/:id', borrowController.updateBorrowRecord);
router.post('/:id/reminder', borrowController.sendEmailNotification);
router.patch('/:id/extend', borrowController.extendBorrowPeriod);
router.patch('/:id/fine/paid', borrowController.markFinePaid);
router.patch('/:id/fine/waived', borrowController.waiveFine);
router.get('/student/:studentId', restrictTo(['admin']), borrowController.getStudentBorrowHistoryByAdmin);
router.get('/daily-traffic', restrictTo(['admin']), borrowController.getDailyTraffic);
router.get('/admin-analytics', restrictTo(['admin']), borrowController.getAdminAnalytics);

// Student route
router.get('/student', restrictTo(['student']), borrowController.getStudentBorrowHistory);

module.exports = router;