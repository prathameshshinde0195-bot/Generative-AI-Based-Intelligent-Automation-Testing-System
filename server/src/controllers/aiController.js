import * as aiService from '../services/aiService.js';
import * as testCaseService from '../services/testCaseService.js';
import * as analyticsService from '../services/analyticsService.js';
import { catchAsync } from '../middleware/error.js';
import TestCase from '../models/TestCase.js';
import Requirement from '../models/Requirement.js';
import RequirementImpact from '../models/RequirementImpact.js';
import GeneratedTestData from '../models/GeneratedTestData.js';
import ChatSession from '../models/ChatSession.js';
import logger from '../utils/logger.js';
import llmService from '../utils/llm-service.js';

export const checkHealth = catchAsync(async (req, res) => {
  const health = await llmService.checkHealth();
  res.status(200).json(health);
});


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
  const { testCaseIds } = req.body;

  if (!testCaseIds || testCaseIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Test case IDs are required',
    });
  }

  const priorities = await aiService.prioritizeTestCases(testCaseIds, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Test cases prioritized successfully',
    data: priorities,
  });
});

export const generateAutomationScript = catchAsync(async (req, res) => {
  const { testCaseId, framework, testCase } = req.body;

  if (!framework || (!testCaseId && !testCase)) {
    return res.status(400).json({
      success: false,
      message: 'Framework and testCase (or testCaseId) are required',
    });
  }

  const script = await testCaseService.generateAutomationScript(
    testCaseId,
    framework,
    req.user.id,
    testCase
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

  const [
    totalTestCases,
    totalRequirements,
    highPriority,
    coverage,
    impactAnalyses,
    testDataSets,
    totalChatSessions,
    chatTestCasesCount,
    allChatSessions
  ] = await Promise.all([
    TestCase.countDocuments(query),
    Requirement.countDocuments(query),
    TestCase.countDocuments({ ...query, priority: 'High' }),
    analyticsService.calculateCoverage(req.user.id, projectId || 'default'),
    RequirementImpact.countDocuments(query),
    GeneratedTestData.countDocuments(query),
    ChatSession.countDocuments(query),
    TestCase.countDocuments({ ...query, testCaseId: { $regex: /^TC-CHAT-/ } }),
    ChatSession.find(query, { 'messages.role': 1 }).lean(),
  ]);

  const totalMessages = allChatSessions.reduce((acc, sess) => acc + (sess.messages?.length || 0), 0);
  const avgConversationLength = allChatSessions.length > 0
    ? Math.round((totalMessages / allChatSessions.length) * 10) / 10
    : 0;

  res.status(200).json({
    success: true,
    data: {
      totalTestCases,
      totalRequirements,
      highPriority,
      coverage: coverage.coveragePercentage,
      automatedCount: await TestCase.countDocuments({ ...query, automationStatus: 'Automated' }),
      impactAnalyses,
      testDataSets,
      totalChatSessions,
      chatTestCasesCount,
      avgConversationLength,
    },
  });
});

// ─── Feature 1: Requirement Change Impact Predictor ───────────────────────────
export const analyzeChangeImpact = catchAsync(async (req, res) => {
  const { projectId: bodyProjectId, oldRequirement, newRequirement } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!oldRequirement || !newRequirement) {
    return res.status(400).json({
      success: false,
      message: 'Both oldRequirement and newRequirement are required',
    });
  }

  const result = await aiService.analyzeChangeImpact(
    oldRequirement,
    newRequirement,
    req.user.id,
    projectId
  );

  res.status(201).json({
    success: true,
    message: `Impact analysis complete. ${result.totalAffected} test case(s) affected.`,
    data: result,
  });
});

export const getChangeImpactHistory = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  const results = await RequirementImpact.find({ userId: req.user.id, projectId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.status(200).json({ success: true, data: results });
});

// ─── Feature 2: AI Test Data Generator ────────────────────────────────────────
export const generateTestData = catchAsync(async (req, res) => {
  const { requirement, testCaseId, testCaseTitle, selectedCategories, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!requirement && !testCaseId) {
    return res.status(400).json({
      success: false,
      message: 'requirement or testCaseId is required',
    });
  }

  const effectiveReq = requirement || `Generate comprehensive test data for Test Case ${testCaseId}: ${testCaseTitle || 'Scenario'}`;

  const result = await aiService.generateTestData(effectiveReq, req.user.id, projectId, {
    testCaseId,
    testCaseTitle,
    selectedCategories,
  });

  const totalItems =
    (result.valid?.length || 0) + (result.invalid?.length || 0) + (result.boundary?.length || 0) +
    (result.edge?.length || 0) + (result.security?.length || 0);

  res.status(201).json({
    success: true,
    message: `Generated ${totalItems} test data items across categories`,
    data: result,
  });
});

export const getTestDataHistory = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  const results = await GeneratedTestData.find({ userId: req.user.id, projectId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.status(200).json({ success: true, data: results });
});

// ─── Chatbot Controllers ──────────────────────────────────────────────────────
export const chatTestCase = catchAsync(async (req, res) => {
  const { sessionId, message, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required',
    });
  }

  const result = await aiService.chatTestCase(sessionId, message, req.user.id, projectId);

  res.status(200).json({
    success: true,
    message: result.saved ? 'Test cases saved successfully' : 'Reply generated successfully',
    data: {
      sessionId: result.session.sessionId,
      reply: result.reply,
      messages: result.session.messages,
      generatedTestCases: result.session.generatedTestCases,
      status: result.session.status,
      saved: result.saved,
      intent: result.intent,
    },
  });
});

/**
 * SSE streaming endpoint for real-time chat.
 * Streams partial text chunks, then sends the final structured JSON result.
 */
export const chatTestCaseStream = catchAsync(async (req, res) => {
  const { sessionId, message, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required',
    });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const result = await aiService.chatTestCaseStream(
      sessionId, message, req.user.id, projectId,
      (chunk) => {
        // Send each text chunk as an SSE event
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    // Send the final structured result
    res.write(`data: ${JSON.stringify({
      type: 'done',
      data: {
        sessionId: result.session.sessionId,
        reply: result.reply,
        messages: result.session.messages,
        generatedTestCases: result.session.generatedTestCases,
        status: result.session.status,
        saved: result.saved,
        intent: result.intent,
      }
    })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  }

  res.end();
});

/**
 * Get all chat sessions for the current user + project.
 */
export const getChatSessions = catchAsync(async (req, res) => {
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  const sessions = await ChatSession.find({
    userId: req.user.id,
    ...(projectId ? { projectId } : {}),
  })
    .sort({ updatedAt: -1 })
    .select('sessionId status messages generatedTestCases createdAt updatedAt')
    .lean();

  // Return summary for each session
  const summaries = sessions.map(s => ({
    sessionId: s.sessionId,
    status: s.status,
    messageCount: s.messages?.length || 0,
    testCaseCount: s.generatedTestCases?.length || 0,
    lastMessage: s.messages?.length > 0 ? s.messages[s.messages.length - 1].content?.substring(0, 100) : '',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));

  res.status(200).json({
    success: true,
    data: summaries,
  });
});

export const saveChatTestCases = catchAsync(async (req, res) => {
  const { sessionId, projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || req.projectId;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required',
    });
  }

  const savedTestCases = await aiService.saveChatTestCases(sessionId, req.user.id, projectId);

  res.status(200).json({
    success: true,
    message: `Successfully saved ${savedTestCases.length} test cases to project`,
    data: savedTestCases,
  });
});

export const getChatSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { projectId: queryProjectId } = req.query;
  const projectId = queryProjectId || req.projectId;

  const session = await aiService.getChatSession(sessionId, req.user.id, projectId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Chat session not found',
    });
  }

  res.status(200).json({
    success: true,
    data: session,
  });
});

