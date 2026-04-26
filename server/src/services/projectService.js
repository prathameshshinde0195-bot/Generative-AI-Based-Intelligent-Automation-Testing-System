import { v4 as uuidv4 } from 'uuid';
import Project from '../models/Project.js';
import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import { ValidationError } from '../utils/errors.js';

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

export async function ensureDefaultProject(userId) {
  const existing = await Project.findOne({ userId, projectId: 'default' });
  if (existing) return existing;

  return await Project.create({
    userId,
    projectId: 'default',
    name: 'Default Project',
    description: 'Auto-created default workspace',
    isDefault: true,
  });
}

export async function listProjects(userId) {
  await ensureDefaultProject(userId);
  return await Project.find({ userId, archivedAt: null }).sort({ isDefault: -1, createdAt: -1 });
}

export async function createProject(userId, data) {
  const name = (data?.name || '').trim();
  if (!name) throw new ValidationError('Project name is required');

  const base = slugify(name) || 'project';
  const projectId = data?.projectId?.trim() || `${base}-${uuidv4().slice(0, 8)}`;

  const project = await Project.create({
    userId,
    projectId,
    name,
    description: (data?.description || '').trim(),
    isDefault: false,
  });

  return project;
}

export async function updateProject(userId, projectId, data) {
  const project = await Project.findOne({ userId, projectId, archivedAt: null });
  if (!project) throw new ValidationError('Project not found');
  if (project.isDefault) throw new ValidationError('Default project cannot be modified');

  if (typeof data?.name === 'string' && data.name.trim()) project.name = data.name.trim();
  if (typeof data?.description === 'string') project.description = data.description.trim();

  await project.save();
  return project;
}

export async function deleteProject(userId, projectId) {
  const project = await Project.findOne({ userId, projectId, archivedAt: null });
  if (!project) throw new ValidationError('Project not found');
  if (project.isDefault || project.projectId === 'default') {
    throw new ValidationError('Default project cannot be deleted');
  }

  await ensureDefaultProject(userId);

  // Reassign data to default rather than deleting it.
  await Promise.all([
    Requirement.updateMany({ userId, projectId }, { $set: { projectId: 'default' } }),
    TestCase.updateMany({ userId, projectId }, { $set: { projectId: 'default' } }),
  ]);

  project.archivedAt = new Date();
  await project.save();

  return { projectId: project.projectId, archivedAt: project.archivedAt };
}

