const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadResource,
  getResources,
  downloadResource,
  deleteResource,
  updateResource,
  getResource,
  getPublicResources
} = require('../controllers/digitalLibraryController');
const authMiddleware = require('../middleware/auth');
const restrictTo = require('../middleware/restrictTo');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Public routes
router.get('/public', getPublicResources);
router.get('/', getResources);
router.get('/:id', getResource);
router.get('/:id/download', authMiddleware, downloadResource);

// Protected routes
router.use(authMiddleware);

// Admin only routes
router.post('/', restrictTo(['admin']), upload.single('file'), uploadResource);
router.put('/:id', restrictTo(['admin']), updateResource);
router.delete('/:id', restrictTo(['admin']), deleteResource);

module.exports = router; 