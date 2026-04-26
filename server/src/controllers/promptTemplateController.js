import { catchAsync } from '../middleware/error.js';
import * as promptTemplateService from '../services/promptTemplateService.js';

export const getSupportedActions = catchAsync(async (_req, res) => {
  res.status(200).json({ success: true, data: promptTemplateService.getSupportedActions() });
});

export const getAISettings = catchAsync(async (req, res) => {
  const settings = await promptTemplateService.getAISettings(req.user.id, req.projectId);
  res.status(200).json({ success: true, data: settings });
});

export const updateAISettings = catchAsync(async (req, res) => {
  const settings = await promptTemplateService.updateAISettings(req.user.id, req.projectId, req.body);
  res.status(200).json({ success: true, message: 'AI settings updated', data: settings });
});

export const listTemplates = catchAsync(async (req, res) => {
  const { action } = req.query;
  const templates = await promptTemplateService.listTemplates(req.user.id, req.projectId, action);
  res.status(200).json({ success: true, data: templates });
});

export const createTemplate = catchAsync(async (req, res) => {
  const template = await promptTemplateService.createTemplate(req.user.id, req.projectId, req.body);
  res.status(201).json({ success: true, message: 'Template created', data: template });
});

export const updateTemplate = catchAsync(async (req, res) => {
  const { templateId } = req.params;
  const template = await promptTemplateService.updateTemplate(req.user.id, req.projectId, templateId, req.body);
  res.status(200).json({ success: true, message: 'Template updated', data: template });
});

export const archiveTemplate = catchAsync(async (req, res) => {
  const { templateId } = req.params;
  const result = await promptTemplateService.archiveTemplate(req.user.id, req.projectId, templateId);
  res.status(200).json({ success: true, message: 'Template archived', data: result });
});

