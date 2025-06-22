const FormSubmission = require("../models/FormSubmission");
const CustomForm = require("../models/CustomForm");
const asyncHandler = require("express-async-handler");
const AppError = require("../utils/appError");

// Static form definitions
const staticForms = {
  "Book Reservation Request": {
    fields: [
      { name: "Book Name", type: "text", required: true },
      { name: "Author", type: "text", required: true },
      { name: "Book ID / ISBN", type: "text", required: true },
      { name: "Expected Return Date", type: "date", required: true },
    ],
  },
  "Book Suggestion": {
    fields: [
      { name: "Book Title", type: "text", required: true },
      { name: "Author", type: "text", required: false },
      { name: "Book ID / ISBN", type: "text", required: false },
      { name: "Reason for Suggestion", type: "textarea", required: false },
    ],
  },
  "Book Renewal Request": {
    fields: [
      { name: "Book ID", type: "text", required: true },
      { name: "Renewal Period (days)", type: "number", required: true },
      { name: "Reason for Renewal Request", type: "textarea", required: false },
    ],
  },
  "Giveaway Request": {
    fields: [
      { name: "Book Title", type: "text", required: true },
      { name: "Quantity", type: "number", required: true },
      { name: "Reason for Request", type: "textarea", required: true },
      { name: "Upload File", type: "file", required: false },
    ],
  },
  "Book Return Issue": {
    fields: [
      { name: "Book ID", type: "text", required: true },
      { name: "Type of Issue", type: "select", required: true, options: "Lost,Damaged" },
      { name: "Description of Issue", type: "textarea", required: true },
      { name: "Lost or Damaged Date", type: "date", required: true },
    ],
  },
};

// Submit a form (student)
const submitForm = asyncHandler(async (req, res, next) => {
  console.log('Received form submission:', {
    formType: req.body.formType,
    formData: req.body.formData,
    body: req.body,
    user: {
      id: req.user?._id,
      role: req.user?.role,
      name: req.user?.name
    }
  });

  const { formType, formData } = req.body;
  const user = req.user;

  if (!user || !user._id) {
    return next(new AppError("User not authenticated", 401));
  }

  // Check if it's a static form
  let form = staticForms[formType];
  console.log('Checking static form:', {
    requestedFormType: formType,
    availableTypes: Object.keys(staticForms),
    found: !!form
  });
  
  // If not static, check custom forms
  if (!form) {
    console.log('Looking for custom form:', formType);
    const customForm = await CustomForm.findOne({ name: formType, isActive: true });
    if (!customForm) {
      console.log('Form not found in either static or custom forms');
      return next(new AppError("Form type not found", 404));
    }
    form = customForm;
  }

  // Log the form data structure
  console.log('Form structure:', {
    type: formType,
    fields: form.fields,
    receivedData: formData
  });

  // Validate required fields
  const missingFields = [];
  form.fields.forEach((field) => {
    if (field.required && !formData[field.name]) {
      missingFields.push(field.name);
    }
  });

  if (missingFields.length > 0) {
    console.log('Missing required fields:', missingFields);
    throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
  }

  try {
    // Convert field names to match the frontend
    const cleanFormData = {};
    Object.entries(formData).forEach(([key, value]) => {
      cleanFormData[key] = value;
    });

    const submission = await FormSubmission.create({
      formType,
      submittedBy: user._id,
      department: user.department,
      rollNumber: user.rollNumber,
      formData: cleanFormData,
      status: "New",
      submittedOn: new Date(),
      lastUpdated: new Date(),
    });

    // Populate submittedBy for the response
    await submission.populate("submittedBy", "name email rollNumber department");

    res.status(201).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Error creating form submission:', error);
    return next(new AppError(error.message, 500));
  }
});

// Get all submissions (admin)
const getFormSubmissions = asyncHandler(async (req, res) => {
  const { formType, status, search } = req.query;

  const query = {};
  if (formType) query.formType = formType;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { formType: { $regex: search, $options: "i" } },
      { "submittedBy.name": { $regex: search, $options: "i" } },
      { "submittedBy.email": { $regex: search, $options: "i" } },
    ];
  }

  const submissions = await FormSubmission.find(query)
    .populate("submittedBy", "name email rollNumber department")
    .sort({ submittedOn: -1 });

  res.status(200).json({
    success: true,
    data: submissions,
  });
});

// Get my submissions (student)
const getMySubmissions = asyncHandler(async (req, res, next) => {
  try {
    const submissions = await FormSubmission.find({
      submittedBy: req.user._id,
    })
      .populate("submittedBy", "name email rollNumber department")
      .sort({ submittedOn: -1 });

    if (!submissions) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const formattedSubmissions = submissions.map((sub) => ({
      _id: sub._id,
      formType: sub.formType,
      status: sub.status,
      submittedOn: sub.submittedOn,
      lastUpdated: sub.lastUpdated,
      formData: sub.formData,
      adminComment: sub.adminComment,
      submittedBy: {
        name: sub.submittedBy.name,
        email: sub.submittedBy.email,
        rollNumber: sub.submittedBy.rollNumber,
        department: sub.submittedBy.department,
      },
    }));

    res.status(200).json({
      success: true,
      data: formattedSubmissions,
    });
  } catch (error) {
    console.error("Error in getMySubmissions:", error);
    return next(new AppError("Error fetching submissions", 500));
  }
});

// Update submission status (admin)
const updateSubmissionStatus = asyncHandler(async (req, res, next) => {
  const { status, adminComment } = req.body;
  const submission = await FormSubmission.findById(req.params.id);

  if (!submission) {
    return next(new AppError("Submission not found", 404));
  }

  submission.status = status;
  submission.adminComment = adminComment;
  submission.lastUpdated = new Date();
  await submission.save();

  // Populate the response
  await submission.populate("submittedBy", "name email rollNumber department");

  res.status(200).json({
    success: true,
    data: submission,
  });
});

// Delete submission (admin)
const deleteSubmission = asyncHandler(async (req, res, next) => {
  const submission = await FormSubmission.findById(req.params.id);

  if (!submission) {
    return next(new AppError("Submission not found", 404));
  }

  await submission.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// Get custom forms (all users)
const getCustomForms = asyncHandler(async (req, res) => {
  const forms = await CustomForm.find({ isActive: true });

  res.status(200).json({
    success: true,
    data: forms,
  });
});

// Create custom form (admin)
const createCustomForm = asyncHandler(async (req, res) => {
  const formData = {
    ...req.body,
    createdBy: req.user._id,
  };

  const form = await CustomForm.create(formData);

  res.status(201).json({
    success: true,
    data: form,
  });
});

// Update custom form (admin)
const updateCustomForm = asyncHandler(async (req, res, next) => {
  const form = await CustomForm.findById(req.params.id);

  if (!form) {
    return next(new AppError("Form not found", 404));
  }

  Object.assign(form, req.body);
  await form.save();

  res.status(200).json({
    success: true,
    data: form,
  });
});

// Delete custom form (admin)
const deleteCustomForm = asyncHandler(async (req, res, next) => {
  const form = await CustomForm.findById(req.params.id);

  if (!form) {
    return next(new AppError("Form not found", 404));
  }

  // Soft delete by setting isActive to false
  form.isActive = false;
  await form.save();

  res.status(200).json({
    success: true,
    data: {},
  });
});

module.exports = {
  submitForm,
  getFormSubmissions,
  updateSubmissionStatus,
  deleteSubmission,
  getCustomForms,
  createCustomForm,
  updateCustomForm,
  deleteCustomForm,
  getMySubmissions,
};
