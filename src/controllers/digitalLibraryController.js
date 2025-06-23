const asyncHandler = require('../middleware/asyncHandler');
const DigitalResource = require('../models/DigitalResource');
const { drive, FOLDER_ID } = require('../config/googleDrive');
const AppError = require('../utils/appError');
const { Readable } = require('stream');

// Upload a file to Google Drive and create resource
exports.uploadResource = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload a file', 400);
  }

  const { title, category, department, description, tags } = req.body;

  // Upload to Google Drive
  const fileMetadata = {
    name: req.file.originalname,
    parents: [FOLDER_ID]
  };

  const media = {
    mimeType: req.file.mimetype,
    body: Readable.from(req.file.buffer)
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, mimeType, size'
  });

  // Create resource in database
  const resource = await DigitalResource.create({
    title,
    category,
    department,
    description,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    fileId: file.data.id,
    fileName: file.data.name,
    mimeType: file.data.mimeType,
    fileSize: file.data.size,
    uploadedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    data: resource
  });
});

// Get all resources with filters
exports.getResources = asyncHandler(async (req, res) => {
  const {
    category,
    department,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = {};

  if (category && category !== 'All') query.category = category;
  if (department) query.department = department;
  if (search) {
    query.$text = { $search: search };
  }

  const resources = await DigitalResource.find(query)
    .sort(sort)
    .populate('uploadedBy', 'name email');

  res.json({
    success: true,
    count: resources.length,
    data: resources
  });
});

// Download a resource
exports.downloadResource = asyncHandler(async (req, res) => {
  const resource = await DigitalResource.findById(req.params.id);
  if (!resource) {
    throw new AppError('Resource not found', 404);
  }

  // Get file from Google Drive
  const file = await drive.files.get({
    fileId: resource.fileId,
    alt: 'media'
  }, {
    responseType: 'stream'
  });

  // Update download count
  resource.downloads += 1;
  await resource.save();

  // Set headers
  res.setHeader('Content-Type', resource.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${resource.fileName}"`);

  // Pipe the file stream to response
  file.data.pipe(res);
});

// Delete a resource
exports.deleteResource = asyncHandler(async (req, res) => {
  console.log('Deleting resource:', req.params.id);
  
  const resource = await DigitalResource.findById(req.params.id);
  if (!resource) {
    throw new AppError('Resource not found', 404);
  }

  try {
    // Try to delete from Google Drive
    console.log('Attempting to delete from Google Drive:', resource.fileId);
    try {
      await drive.files.delete({
        fileId: resource.fileId
      });
      console.log('Successfully deleted from Google Drive');
    } catch (driveError) {
      // If file not found in Google Drive, just log and continue
      console.log('Google Drive delete error (continuing anyway):', driveError.message);
    }

    // Delete from database regardless of Google Drive status
    console.log('Deleting from database');
    await DigitalResource.deleteOne({ _id: req.params.id });
    console.log('Successfully deleted from database');

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error in deleteResource:', error);
    throw new AppError('Failed to delete resource: ' + error.message, 500);
  }
});

// Update resource details
exports.updateResource = asyncHandler(async (req, res) => {
  const allowedUpdates = ['title', 'category', 'department', 'description', 'tags', 'status'];
  const updates = Object.keys(req.body).filter(key => allowedUpdates.includes(key));
  
  const resource = await DigitalResource.findById(req.params.id);
  if (!resource) {
    throw new AppError('Resource not found', 404);
  }

  updates.forEach(update => {
    if (update === 'tags') {
      resource[update] = req.body[update].split(',').map(tag => tag.trim());
    } else {
      resource[update] = req.body[update];
    }
  });

  await resource.save();

  res.json({
    success: true,
    data: resource
  });
});

// Get resource details
exports.getResource = asyncHandler(async (req, res) => {
  const resource = await DigitalResource.findById(req.params.id)
    .populate('uploadedBy', 'name email');

  if (!resource) {
    throw new AppError('Resource not found', 404);
  }

  // Update view count
  resource.views += 1;
  await resource.save();

  res.json({
    success: true,
    data: resource
  });
});

// Get public resources
exports.getPublicResources = asyncHandler(async (req, res) => {
  const {
    category,
    department,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = { status: 'Active' };

  if (category && category !== 'All') query.category = category;
  if (department) query.department = department;
  if (search) {
    query.$text = { $search: search };
  }

  const resources = await DigitalResource.find(query)
    .sort(sort)
    .select('-__v')
    .populate('uploadedBy', 'name');

  res.json({
    success: true,
    count: resources.length,
    data: resources
  });
}); 