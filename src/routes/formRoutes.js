const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');
const {
  submitForm,
  getFormSubmissions,
  updateSubmissionStatus,
  deleteSubmission,
  getCustomForms,
  createCustomForm,
  updateCustomForm,
  deleteCustomForm,
  getMySubmissions
} = require('../controllers/formController');

// Student routes
router.post('/', auth, submitForm);
router.get('/my-submissions', auth, getMySubmissions);

// Admin routes
router.get('/', auth, restrictTo(['admin']), getFormSubmissions);
router.put('/:id/status', auth, restrictTo(['admin']), updateSubmissionStatus);
router.delete('/:id', auth, restrictTo(['admin']), deleteSubmission);

// Custom forms routes
router.get('/custom', auth, getCustomForms);
router.post('/custom', auth, restrictTo(['admin']), createCustomForm);
router.put('/custom/:id', auth, restrictTo(['admin']), updateCustomForm);
router.delete('/custom/:id', auth, restrictTo(['admin']), deleteCustomForm);

module.exports = router;