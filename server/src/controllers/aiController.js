import * as aiService from '../services/aiService.js';
import * as testCaseService from '../services/testCaseService.js';
import * as analyticsService from '../services/analyticsService.js';
import { catchAsync } from '../middleware/error.js';
import TestCase from '../models/TestCase.js';
import Requirement from '../models/Requirement.js';
import logger from '../utils/logger.js';

export const generateTestCases = catchAsync(async (req, res) => {
  const { requirementText, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!requirementText) {
    return res.status(400).json({
      success: false,
      message: 'Requirement text is required',
    });
  }

  const testCases = await aiService.generateTestCasesFromRequirement(
    requirementText,
    req.user.id,
    projectId
  );

  res.status(201).json({
    success: true,
    message: `Generated ${testCases.length} test cases`,
    data: testCases,
  });
});

export const detectAmbiguities = catchAsync(async (req, res) => {
  const { requirementText } = req.body;

  if (!requirementText) {
    return res.status(400).json({
      success: false,
      message: 'Requirement text is required',
    });
  }

  const ambiguities = await aiService.detectAmbiguities(requirementText, req.user.id, req.projectId);

  res.status(200).json({
    success: true,
    message: `Detected ${ambiguities.length} ambiguities`,
    data: ambiguities,
  });
});

export const prioritizeTestCases = catchAsync(async (req, res) => {
  const { testCaseIds, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!testCaseIds || testCaseIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Test case IDs are required',
    });
  }

  const priorities = await aiService.prioritizeTestCases(testCaseIds, req.user.id, projectId);

  res.status(200).json({
    success: true,
    message: 'Test cases prioritized successfully',
    data: priorities,
  });
});

export const generateAutomationScript = catchAsync(async (req, res) => {
  const { testCaseId, framework } = req.body;

  if (!testCaseId || !framework) {
    return res.status(400).json({
      success: false,
      message: 'Test case ID and framework are required',
    });
  }

  const script = await testCaseService.generateAutomationScript(
    testCaseId,
    framework,
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: 'Automation script generated successfully',
    data: script,
  });
});

export const detectDuplicates = catchAsync(async (req, res) => {
  const { testCaseIds } = req.body;

  if (!testCaseIds || testCaseIds.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'At least 2 test case IDs are required',
    });
  }

  const duplicates = await testCaseService.detectDuplicateTestCases(testCaseIds, req.user.id);

  res.status(200).json({
    success: true,
    message: `Found ${duplicates.length} duplicate pairs`,
    data: duplicates,
  });
});

export const generateNegativeTestCases = catchAsync(async (req, res) => {
  const { requirementText, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!requirementText) {
    return res.status(400).json({
      success: false,
      message: 'Requirement text is required',
    });
  }

  const testCases = await testCaseService.generateNegativeTestCases(
    requirementText,
    req.user.id,
    projectId
  );

  res.status(201).json({
    success: true,
    message: `Generated ${testCases.length} negative test cases`,
    data: testCases,
  });
});

export const getTraceabilityMatrix = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: 'Project ID is required',
    });
  }

  const matrix = await testCaseService.generateTraceabilityMatrix(req.user.id, projectId);

  res.status(200).json({
    success: true,
    message: 'Traceability matrix generated successfully',
    data: matrix,
  });
});

export const getCoverageAnalysis = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: 'Project ID is required',
    });
  }

  const coverage = await analyticsService.calculateCoverage(req.user.id, projectId);

  res.status(200).json({
    success: true,
    message: 'Coverage analysis completed',
    data: coverage,
  });
});

export const assessRisk = catchAsync(async (req, res) => {
  const { requirementText, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!requirementText) {
    return res.status(400).json({
      success: false,
      message: 'Requirement text is required',
    });
  }

  const testCases = await TestCase.find({ userId: req.user.id, projectId });
  const riskAssessment = await analyticsService.assessRisk(
    requirementText,
    testCases,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Risk assessment completed',
    data: riskAssessment,
  });
});

export const getDashboardMetrics = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  const query = { userId: req.user.id };
  if (projectId) query.projectId = projectId;

  const [totalTestCases, totalRequirements, highPriority, coverage] = await Promise.all([
    TestCase.countDocuments(query),
    Requirement.countDocuments(query),
    TestCase.countDocuments({ ...query, priority: 'High' }),
    analyticsService.calculateCoverage(req.user.id, projectId || 'default'),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalTestCases,
      totalRequirements,
      highPriority,
      coverage: coverage.coveragePercentage,
      automatedCount: await TestCase.countDocuments({ ...query, automationStatus: 'Automated' }),
    },
  });
});
