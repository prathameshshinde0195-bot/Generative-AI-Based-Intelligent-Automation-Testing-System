import { catchAsync } from '../middleware/error.js';
import * as testRunService from '../services/testRunService.js';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { ValidationError } from '../utils/errors.js';

function validateCreatePayload(payload = {}) {
  const runType = payload.runType === 'realtime-tc' ? 'realtime-tc' : 'command';
  if (runType === 'command') {
    const command = String(payload.command || '').trim();
    if (!command) {
      throw new ValidationError('Command is required for command runs');
    }
    return;
  }

  const realtimeConfig = payload.realtimeConfig || {};
  const baseUrl = String(realtimeConfig.targetBaseUrl || '').trim();
  if (!baseUrl) {
    throw new ValidationError('Realtime target base URL is required');
  }

  const checks = Array.isArray(realtimeConfig.checks) ? realtimeConfig.checks : [];
  if (checks.length === 0) {
    throw new ValidationError('At least one realtime check is required');
  }

  for (const check of checks) {
    if (!String(check?.testCaseId || '').trim()) {
      throw new ValidationError('Each realtime check must include testCaseId');
    }
    if (!String(check?.endpoint || '').trim()) {
      throw new ValidationError(`Endpoint is required for testCaseId ${check?.testCaseId || 'unknown'}`);
    }
  }
}

export const createTestRun = catchAsync(async (req, res) => {
  const { framework, command, externalUrl, execute, runType, realtimeConfig } = req.body || {};
  validateCreatePayload({ framework, command, externalUrl, execute, runType, realtimeConfig });
  const run = await testRunService.createRun({
    userId: req.user.id,
    projectId: req.projectId,
    framework,
    command,
    externalUrl,
    runType,
    realtimeConfig,
    execute: Boolean(execute),
  });

  res.status(201).json({ success: true, message: 'Test run created', data: run });
});

export const listTestRuns = catchAsync(async (req, res) => {
  const { status } = req.query;
  const runs = await testRunService.listRuns({
    userId: req.user.id,
    projectId: req.projectId,
    status,
  });
  res.status(200).json({ success: true, data: runs });
});

export const getTestRun = catchAsync(async (req, res) => {
  const run = await testRunService.getRun({
    userId: req.user.id,
    projectId: req.projectId,
    runId: req.params.runId,
  });
  if (!run) return res.status(404).json({ success: false, message: 'Test run not found' });
  res.status(200).json({ success: true, data: run });
});

export const executeTestRun = catchAsync(async (req, res) => {
  const run = await testRunService.executeRun(req.params.runId, { userId: req.user.id });
  res.status(200).json({ success: true, message: 'Test run started', data: run });
});

export const cancelTestRun = catchAsync(async (req, res) => {
  const run = await testRunService.cancelRun({
    userId: req.user.id,
    projectId: req.projectId,
    runId: req.params.runId,
  });
  res.status(200).json({ success: true, message: 'Test run cancelled', data: run });
});

export const streamTestRun = catchAsync(async (req, res) => {
  // EventSource can't send Authorization headers reliably; allow token via query string.
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  let decoded;
  try {
    decoded = verifyToken(String(token));
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ success: false, message: 'User not found' });
  req.user = user;

  const run = await testRunService.getRun({
    userId: req.user.id,
    projectId: req.projectId,
    runId: req.params.runId,
  });
  if (!run) return res.status(404).json({ success: false, message: 'Test run not found' });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // Send initial snapshot.
  res.write(`data: ${JSON.stringify({ type: 'snapshot', run })}\n\n`);

  const unsubscribe = testRunService.subscribeToRun(run.runId, res);

  req.on('close', () => {
    unsubscribe();
    try {
      res.end();
    } catch {
      // ignore
    }
  });
});

