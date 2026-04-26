import { catchAsync } from '../middleware/error.js';
import * as projectService from '../services/projectService.js';

export const listProjects = catchAsync(async (req, res) => {
  const projects = await projectService.listProjects(req.user.id);
  res.status(200).json({ success: true, data: projects });
});

export const createProject = catchAsync(async (req, res) => {
  const project = await projectService.createProject(req.user.id, req.body);
  res.status(201).json({ success: true, message: 'Project created', data: project });
});

export const updateProject = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await projectService.updateProject(req.user.id, projectId, req.body);
  res.status(200).json({ success: true, message: 'Project updated', data: project });
});

export const deleteProject = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const result = await projectService.deleteProject(req.user.id, projectId);
  res.status(200).json({ success: true, message: 'Project archived', data: result });
});

