import PromptTemplate from '../models/PromptTemplate.js';
import AISettings from '../models/AISettings.js';
import { ValidationError } from '../utils/errors.js';

const ACTIONS = [
  'generate_test_cases',
  'detect_ambiguities',
  'prioritize_tests',
  'generate_negative_test_cases',
  'assess_risk',
];

export function getSupportedActions() {
  return ACTIONS;
}

export async function ensureAISettings(userId, projectId) {
  const existing = await AISettings.findOne({ userId, projectId });
  if (existing) return existing;
  return await AISettings.create({ userId, projectId });
}

export async function getAISettings(userId, projectId) {
  return await ensureAISettings(userId, projectId);
}

export async function updateAISettings(userId, projectId, updates) {
  const allowed = {};
  if (typeof updates?.systemPrompt === 'string') allowed.systemPrompt = updates.systemPrompt;
  if (typeof updates?.model === 'string') allowed.model = updates.model;
  if (typeof updates?.temperature === 'number') allowed.temperature = updates.temperature;
  if (typeof updates?.maxTokens === 'number') allowed.maxTokens = updates.maxTokens;

  const doc = await AISettings.findOneAndUpdate(
    { userId, projectId },
    { $set: allowed },
    { new: true, upsert: true, runValidators: true }
  );
  return doc;
}

export async function listTemplates(userId, projectId, action) {
  const query = { userId, projectId, archivedAt: null };
  if (action) query.action = action;
  return await PromptTemplate.find(query).sort({ isDefault: -1, createdAt: -1 });
}

export async function createTemplate(userId, projectId, data) {
  const name = (data?.name || '').trim();
  const action = data?.action;
  const template = String(data?.template || '');
  const isDefault = Boolean(data?.isDefault);

  if (!name) throw new ValidationError('Template name is required');
  if (!ACTIONS.includes(action)) throw new ValidationError(`Unsupported action: ${action}`);
  if (!template.trim()) throw new ValidationError('Template content is required');

  if (isDefault) {
    await PromptTemplate.updateMany(
      { userId, projectId, action, archivedAt: null, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  return await PromptTemplate.create({
    userId,
    projectId,
    name,
    action,
    template,
    isDefault,
  });
}

export async function updateTemplate(userId, projectId, templateId, data) {
  const doc = await PromptTemplate.findOne({ _id: templateId, userId, projectId, archivedAt: null });
  if (!doc) throw new ValidationError('Template not found');

  if (typeof data?.name === 'string' && data.name.trim()) doc.name = data.name.trim();
  if (typeof data?.template === 'string' && data.template.trim()) doc.template = data.template;
  if (typeof data?.isDefault === 'boolean') doc.isDefault = data.isDefault;

  if (doc.isDefault) {
    await PromptTemplate.updateMany(
      { userId, projectId, action: doc.action, archivedAt: null, isDefault: true, _id: { $ne: doc._id } },
      { $set: { isDefault: false } }
    );
  }

  await doc.save();
  return doc;
}

export async function archiveTemplate(userId, projectId, templateId) {
  const doc = await PromptTemplate.findOne({ _id: templateId, userId, projectId, archivedAt: null });
  if (!doc) throw new ValidationError('Template not found');
  doc.archivedAt = new Date();
  doc.isDefault = false;
  await doc.save();
  return { id: doc._id, archivedAt: doc.archivedAt };
}

export async function resolvePromptForAction(userId, projectId, action, variables = {}) {
  const templateDoc =
    (await PromptTemplate.findOne({ userId, projectId, action, archivedAt: null, isDefault: true })) ||
    (await PromptTemplate.findOne({ userId, projectId: 'default', action, archivedAt: null, isDefault: true }));

  if (!templateDoc) return null;

  let prompt = templateDoc.template;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, String(value));
  }
  return prompt;
}

