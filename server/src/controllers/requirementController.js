import Requirement from '../models/Requirement.js';
import { catchAsync } from '../middleware/error.js';
import logger from '../utils/logger.js';

export const createRequirement = catchAsync(async (req, res) => {
  const { projectId: bodyProjectId, requirementId, title, description, category, priority } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!projectId || !requirementId || !title || !description) {
    return res.status(400).json({
      success: false,
      message: 'Project ID, requirement ID, title, and description are required',
    });
  }

  const requirement = new Requirement({
    userId: req.user.id,
    projectId,
    requirementId,
    title,
    description,
    category: category || 'Functional',
    priority: priority || 'Medium',
    status: 'Draft',
    rawContent: description,
  });

  await requirement.save();

  res.status(201).json({
    success: true,
    message: 'Requirement created successfully',
    data: requirement,
  });
});

export const getRequirements = catchAsync(async (req, res) => {
  const { projectId: queryProjectId, status } = req.query;
  const projectId = queryProjectId || req.projectId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const query = { userId: req.user.id };
  if (projectId) query.projectId = projectId;
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [requirements, total] = await Promise.all([
    Requirement.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Requirement.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: requirements,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getRequirementById = catchAsync(async (req, res) => {
  const requirement = await Requirement.findById(req.params.id);

  if (!requirement || requirement.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }

  res.status(200).json({
    success: true,
    data: requirement,
  });
});

export const updateRequirement = catchAsync(async (req, res) => {
  let requirement = await Requirement.findById(req.params.id);

  if (!requirement || requirement.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }

  requirement = await Requirement.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'Requirement updated successfully',
    data: requirement,
  });
});

export const deleteRequirement = catchAsync(async (req, res) => {
  const requirement = await Requirement.findById(req.params.id);

  if (!requirement || requirement.userId.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Requirement not found',
    });
  }

  await Requirement.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Requirement deleted successfully',
  });
});
