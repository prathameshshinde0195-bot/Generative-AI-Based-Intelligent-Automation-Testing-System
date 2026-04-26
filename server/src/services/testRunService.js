import { spawn } from 'child_process';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import TestRun from '../models/TestRun.js';
import TestCase from '../models/TestCase.js';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const running = new Map(); // runId -> child process
const MAX_LOG_CHARS = 200_000;
const subscribers = new Map(); // runId -> Set<ServerResponse>

function appendCapped(existing, nextChunk) {
  const combined = (existing || '') + (nextChunk || '');
  if (combined.length <= MAX_LOG_CHARS) return combined;
  return combined.slice(combined.length - MAX_LOG_CHARS);
}

function broadcast(runId, payload) {
  const subs = subscribers.get(runId);
  if (!subs || subs.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subs) {
    try {
      res.write(data);
    } catch {
      // ignore broken pipes
    }
  }
}

export function subscribeToRun(runId, res) {
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId).add(res);
  return () => {
    const subs = subscribers.get(runId);
    if (!subs) return;
    subs.delete(res);
    if (subs.size === 0) subscribers.delete(runId);
  };
}

function isCommandAllowed(cmd) {
  const trimmed = String(cmd || '').trim();
  if (!trimmed) return false;
  // Basic safety: only allow npm/npx commands in dev mode.
  return /^(npm|npx)\s+/i.test(trimmed);
}

function resolveRunCwd() {
  // Prefer explicit configuration.
  const configured = (process.env.TEST_RUN_CWD || process.env.PROJECT_ROOT || '').trim();
  if (configured) return configured;

  // Heuristic: if backend is started from ".../server", run tests from repo root.
  const cwd = process.cwd();
  if (path.basename(cwd).toLowerCase() === 'server') {
    return path.resolve(cwd, '..');
  }
  return cwd;
}

function normalizeCheck(check) {
  return {
    testCaseId: String(check?.testCaseId || '').trim(),
    endpoint: String(check?.endpoint || '').trim(),
    method: String(check?.method || 'GET').toUpperCase(),
    expectedStatus: Number.isFinite(Number(check?.expectedStatus)) ? Number(check.expectedStatus) : 200,
    expectedText: String(check?.expectedText || '').trim(),
    variants: Array.isArray(check?.variants) ? check.variants.map(normalizeVariant) : [],
  };
}

function normalizeVariant(variant) {
  const method = String(variant?.method || 'GET').toUpperCase();
  const assertionType = String(variant?.assertionType || 'status+text').trim();
  return {
    label: String(variant?.label || 'default').trim() || 'default',
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method) ? method : 'GET',
    body: variant?.body && typeof variant.body === 'object' ? variant.body : null,
    headers: variant?.headers && typeof variant.headers === 'object' ? variant.headers : null,
    query: variant?.query && typeof variant.query === 'object' ? variant.query : null,
    expectedStatus: Number.isFinite(Number(variant?.expectedStatus)) ? Number(variant.expectedStatus) : 200,
    expectedText: String(variant?.expectedText || '').trim(),
    assertionType: ['status', 'text', 'status+text', 'jsonPath'].includes(assertionType) ? assertionType : 'status+text',
    assertionJsonPath: String(variant?.assertionJsonPath || '').trim(),
    assertionExpectedValue: String(variant?.assertionExpectedValue || '').trim(),
    maxRetries: Number.isFinite(Number(variant?.maxRetries)) ? Math.max(0, Number(variant.maxRetries)) : 0,
  };
}

function readJsonPath(data, pathExpression) {
  if (!pathExpression) return undefined;
  const normalized = pathExpression.replace(/^\$\./, '').trim();
  if (!normalized) return undefined;
  return normalized.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, data);
}

function evaluateAssertion({ assertionType, expectedStatus, expectedText, assertionJsonPath, assertionExpectedValue, responseStatus, responseBodyText, responseData }) {
  const statusOk = responseStatus === expectedStatus;
  const textMatched = !expectedText || responseBodyText.toLowerCase().includes(expectedText.toLowerCase());

  if (assertionType === 'status') {
    return { pass: statusOk, textMatched, message: statusOk ? 'Status assertion passed' : `Expected status ${expectedStatus}` };
  }
  if (assertionType === 'text') {
    return { pass: textMatched, textMatched, message: textMatched ? 'Text assertion passed' : `Expected text "${expectedText}"` };
  }
  if (assertionType === 'jsonPath') {
    const actual = readJsonPath(responseData, assertionJsonPath);
    const actualString = actual === undefined ? '' : String(actual);
    const pass = actualString === String(assertionExpectedValue || '');
    return {
      pass,
      textMatched,
      message: pass
        ? `jsonPath assertion passed (${assertionJsonPath})`
        : `jsonPath assertion failed (${assertionJsonPath} expected "${assertionExpectedValue}", got "${actualString}")`,
    };
  }
  const pass = statusOk && textMatched;
  return {
    pass,
    textMatched,
    message: pass
      ? 'Status+text assertion passed'
      : `Expected status ${expectedStatus}${expectedText ? ` and text "${expectedText}"` : ''}`,
  };
}

async function executeRealtimeTcRun(doc) {
  const startedAt = new Date();
  await TestRun.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: 'Running',
        startedAt,
        finishedAt: null,
        exitCode: null,
        stdout: '',
        stderr: '',
        tcCheckResults: [],
        tcCheckSummary: { total: 0, passed: 0, failed: 0, flakyCount: 0, confidenceScore: 0 },
      },
    }
  );
  let flakyCount = 0;
  broadcast(doc.runId, { type: 'status', status: 'Running', startedAt });

  const targetBaseUrl = String(doc?.realtimeConfig?.targetBaseUrl || '').trim().replace(/\/+$/, '');
  const checks = Array.isArray(doc?.realtimeConfig?.checks) ? doc.realtimeConfig.checks.map(normalizeCheck) : [];
  const variants = Array.isArray(doc?.realtimeConfig?.variants)
    ? doc.realtimeConfig.variants.map(normalizeVariant).filter((v) => v.label)
    : [];
  const runVariants = variants.length > 0 ? variants : [normalizeVariant({ label: 'default', method: 'GET' })];
  if (!targetBaseUrl) {
    throw new ValidationError('Realtime target base URL is required');
  }
  if (checks.length === 0) {
    throw new ValidationError('At least one realtime check is required');
  }

  const tcIds = checks.map((c) => c.testCaseId).filter(Boolean);
  const testCases = await TestCase.find({ userId: doc.userId, projectId: doc.projectId, testCaseId: { $in: tcIds } });
  const tcById = new Map(testCases.map((tc) => [tc.testCaseId, tc]));

  const results = [];
  let passed = 0;
  let stdout = '';
  let stderr = '';

  for (const check of checks) {
    const tc = tcById.get(check.testCaseId);
    const endpoint = check.endpoint.startsWith('/') ? check.endpoint : `/${check.endpoint}`;
    const url = `${targetBaseUrl}${endpoint}`;
    const method = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(check.method) ? check.method : 'GET';

    const checkVariants = check.variants && check.variants.length > 0 ? check.variants : runVariants;
    for (const variant of checkVariants) {
      const variantMethod = variant.method || method;
      const expectedStatus = variant.expectedStatus ?? check.expectedStatus;
      const expectedText = variant.expectedText || check.expectedText;
      const requestSnippet = variant.body ? JSON.stringify(variant.body).slice(0, 300) : '';
      let result = {
        testCaseId: check.testCaseId,
        scenario: tc?.scenario || 'Unknown test case',
        variantLabel: variant.label,
        endpoint,
        method: variantMethod,
        expectedStatus,
        actualStatus: null,
        expectedText,
        textMatched: false,
        passed: false,
        message: '',
        requestSnippet,
        responseSnippet: '',
        retriesUsed: 0,
        checkedAt: new Date(),
      };

      try {
        let response;
        let retriesUsed = 0;
        const maxRetries = variant.maxRetries || 0;
        while (true) {
          response = await axios.request({
            url,
            method: variantMethod,
            data: variant.body || undefined,
            headers: variant.headers || undefined,
            params: variant.query || undefined,
            timeout: 15000,
            validateStatus: () => true,
          });
          const retryableStatus = response.status >= 500 || response.status === 429;
          if (!retryableStatus || retriesUsed >= maxRetries) break;
          retriesUsed += 1;
          await new Promise((resolve) => setTimeout(resolve, 400 * retriesUsed));
        }
        const bodyAsText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const snippet = bodyAsText.slice(0, 400);
        const evaluation = evaluateAssertion({
          assertionType: variant.assertionType,
          expectedStatus,
          expectedText,
          assertionJsonPath: variant.assertionJsonPath,
          assertionExpectedValue: variant.assertionExpectedValue,
          responseStatus: response.status,
          responseBodyText: bodyAsText,
          responseData: response.data,
        });
        const pass = evaluation.pass;
        if (pass && retriesUsed > 0) flakyCount += 1;

        result = {
          ...result,
          actualStatus: response.status,
          responseSnippet: snippet,
          textMatched: evaluation.textMatched,
          passed: pass,
          message: evaluation.message,
          retriesUsed,
        };
        if (pass) passed += 1;
        stdout = appendCapped(stdout, `[${check.testCaseId}/${variant.label}] ${variantMethod} ${endpoint} -> ${response.status} ${pass ? 'PASS' : 'FAIL'} (retries:${result.retriesUsed})\n`);
        if (!pass) {
          stderr = appendCapped(stderr, `[${check.testCaseId}/${variant.label}] Assertion failed for ${variantMethod} ${endpoint}\n`);
        }
      } catch (error) {
        const message = error?.message || 'Request failed';
        result = { ...result, message };
        stderr = appendCapped(stderr, `[${check.testCaseId}/${variant.label}] ${variantMethod} ${endpoint} ERROR: ${message}\n`);
      }

      results.push(result);
      broadcast(doc.runId, { type: 'tc-check', result });
      await TestRun.updateOne(
        { _id: doc._id },
        {
          $set: {
            stdout,
            stderr,
            tcCheckResults: results,
            tcCheckSummary: {
              total: results.length,
              passed,
              failed: results.length - passed,
              flakyCount,
              confidenceScore: results.length > 0 ? Math.round(((passed - flakyCount * 0.5) / results.length) * 100) : 0,
            },
          },
        }
      );
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const totalChecks = results.length;
  const failed = totalChecks - passed;
  const finalStatus = failed === 0 ? 'Passed' : 'Failed';
  const confidenceScore = totalChecks > 0 ? Math.round(((passed - flakyCount * 0.5) / totalChecks) * 100) : 0;

  await TestRun.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: finalStatus,
        finishedAt,
        durationMs,
        exitCode: failed === 0 ? 0 : 1,
        stdout,
        stderr,
        tcCheckResults: results,
        tcCheckSummary: { total: totalChecks, passed, failed, flakyCount, confidenceScore },
      },
    }
  );

  broadcast(doc.runId, {
    type: 'done',
    status: finalStatus,
    exitCode: failed === 0 ? 0 : 1,
    finishedAt,
    durationMs,
  });
}

export async function createRun({ userId, projectId, framework, command, externalUrl, runType, realtimeConfig, execute }) {
  const runId = `TR-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const normalizedRunType = runType === 'realtime-tc' ? 'realtime-tc' : 'command';
  const allow = process.env.ALLOW_TEST_RUN_COMMANDS === 'true';
  const canExecuteCommandNow = normalizedRunType === 'command' && Boolean(execute) && allow && isCommandAllowed(command);
  const canExecuteRealtimeNow = normalizedRunType === 'realtime-tc' && Boolean(execute);
  const canExecuteNow = canExecuteCommandNow || canExecuteRealtimeNow;
  const checks = Array.isArray(realtimeConfig?.checks) ? realtimeConfig.checks.map(normalizeCheck) : [];
  const variants = Array.isArray(realtimeConfig?.variants) ? realtimeConfig.variants.map(normalizeVariant) : [];

  const doc = await TestRun.create({
    userId,
    projectId,
    runId,
    framework: framework || 'other',
    runType: normalizedRunType,
    command: command || '',
    externalUrl: externalUrl || '',
    status: canExecuteNow ? 'Queued' : 'Created',
    realtimeConfig: {
      targetBaseUrl: String(realtimeConfig?.targetBaseUrl || '').trim(),
      variants,
      checks,
    },
    triggeredBy: 'manual',
    stderr: normalizedRunType === 'command' && !allow && execute
      ? appendCapped('', '\n[system] Execution is disabled. Set ALLOW_TEST_RUN_COMMANDS=true to enable.\n')
      : (normalizedRunType === 'command' && execute && !isCommandAllowed(command))
        ? appendCapped('', '\n[system] Command blocked. Only npm/npx commands are allowed.\n')
        : '',
  });
  logger.info(`Test run created: ${doc.runId}`, { userId: String(userId), projectId, runType: normalizedRunType });

  if (canExecuteNow) {
    // Fire-and-forget, but never allow an unhandled rejection to crash the server.
    void executeRun(doc.runId, { userId }).catch(async (err) => {
      try {
        const latest = await TestRun.findOne({ runId: doc.runId, userId });
        if (!latest) return;
        latest.status = 'Failed';
        latest.finishedAt = new Date();
        latest.durationMs = latest.startedAt ? Date.now() - latest.startedAt.getTime() : 0;
        latest.exitCode = null;
        latest.stderr = appendCapped(latest.stderr, `\n[system] ${err?.message || String(err)}\n`);
        latest.processPid = null;
        await latest.save();
      } catch {
        // ignore - best effort
      }
    });
  }

  return doc;
}

export async function listRuns({ userId, projectId, status }) {
  const query = { userId, projectId };
  if (status) query.status = status;
  return await TestRun.find(query).sort({ createdAt: -1 }).limit(200);
}

export async function getRun({ userId, projectId, runId }) {
  const doc = await TestRun.findOne({ userId, projectId, runId });
  return doc;
}

export async function cancelRun({ userId, projectId, runId }) {
  const doc = await TestRun.findOne({ userId, projectId, runId });
  if (!doc) throw new ValidationError('Test run not found');
  if (!['Queued', 'Running'].includes(doc.status)) return doc;

  const child = running.get(runId);
  if (child && child.pid) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  const finishedAt = new Date();
  const durationMs = doc.startedAt ? Date.now() - doc.startedAt.getTime() : 0;
  await TestRun.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: 'Cancelled',
        finishedAt,
        durationMs,
        processPid: null,
      },
    }
  );
  running.delete(runId);
  logger.info(`Test run cancelled: ${runId}`, { userId: String(userId), projectId });
  return await TestRun.findById(doc._id);
}

export async function executeRun(runId, { userId }) {
  const doc = await TestRun.findOne({ runId, userId });
  if (!doc) throw new ValidationError('Test run not found');
  if (doc.status === 'Running') return doc;

  if (doc.runType === 'realtime-tc') {
    logger.info(`Executing realtime test run: ${runId}`, { userId: String(userId), projectId: doc.projectId });
    await executeRealtimeTcRun(doc);
    return await TestRun.findById(doc._id);
  }

  const allow = process.env.ALLOW_TEST_RUN_COMMANDS === 'true';
  if (!allow) {
    throw new ValidationError('Test run execution is disabled. Set ALLOW_TEST_RUN_COMMANDS=true to enable.');
  }

  if (!isCommandAllowed(doc.command)) {
    throw new ValidationError('Only npm/npx commands are allowed for execution.');
  }

  const startedAt = new Date();
  await TestRun.updateOne(
    { _id: doc._id },
    {
      $set: {
        status: 'Running',
        startedAt,
        finishedAt: null,
        exitCode: null,
        stdout: '',
        stderr: '',
      },
    }
  );
  broadcast(runId, { type: 'status', status: 'Running', startedAt });

  const child = spawn(doc.command, {
    cwd: resolveRunCwd(),
    shell: true,
    env: process.env,
    windowsHide: true,
  });
  running.set(runId, child);
  const processPid = child.pid || null;
  await TestRun.updateOne({ _id: doc._id }, { $set: { processPid } });
  broadcast(runId, { type: 'pid', processPid });

  let stdoutCache = '';
  let stderrCache = '';
  let persistQueue = Promise.resolve();
  const queuePersist = (update) => {
    persistQueue = persistQueue
      .then(() => TestRun.updateOne({ _id: doc._id }, { $set: update }))
      .catch(() => {
        // swallow queue errors to keep stream alive
      });
  };

  child.stdout?.on('data', async (buf) => {
    const chunk = buf.toString('utf8');
    stdoutCache = appendCapped(stdoutCache, chunk);
    broadcast(runId, { type: 'stdout', chunk });
    queuePersist({ stdout: stdoutCache });
  });
  child.stderr?.on('data', async (buf) => {
    const chunk = buf.toString('utf8');
    stderrCache = appendCapped(stderrCache, chunk);
    broadcast(runId, { type: 'stderr', chunk });
    queuePersist({ stderr: stderrCache });
  });

  child.on('close', async (code) => {
    try {
      await persistQueue;
      const latest = await TestRun.findOne({ _id: doc._id });
      if (!latest) return;
      latest.exitCode = typeof code === 'number' ? code : null;
      latest.finishedAt = new Date();
      latest.durationMs = latest.startedAt ? Date.now() - latest.startedAt.getTime() : 0;
      if (latest.status !== 'Cancelled') {
        latest.status = code === 0 ? 'Passed' : 'Failed';
      }
      latest.processPid = null;
      await latest.save();
      broadcast(runId, {
        type: 'done',
        status: latest.status,
        exitCode: latest.exitCode,
        finishedAt: latest.finishedAt,
        durationMs: latest.durationMs,
      });
    } finally {
      running.delete(runId);
    }
  });

  return doc;
}

