import TestCase from '../models/TestCase.js';
import Requirement from '../models/Requirement.js';
import llmService from '../utils/llm-service.js';
import AILog from '../models/AILog.js';
import logger from '../utils/logger.js';
import { getAISettings, resolvePromptForAction } from './promptTemplateService.js';
import RequirementImpact from '../models/RequirementImpact.js';
import GeneratedTestData from '../models/GeneratedTestData.js';
import ChatSession from '../models/ChatSession.js';

const VAGUE_WORDS = [
  'appropriate', 'adequate', 'reasonable', 'sufficient', 'fast', 'slow',
  'user-friendly', 'intuitive', 'easy', 'simple', 'complex', 'various',
  'several', 'many', 'few', 'some', 'etc', 'and so on', 'as needed',
  'if necessary', 'as appropriate', 'timely', 'quickly', 'efficiently',
  'effectively', 'properly', 'correctly', 'good', 'bad', 'nice', 'better',
];

const SECURITY_KEYWORDS = [
  'authentication', 'authorization', 'password', 'encryption', 'token',
  'session', 'login', 'logout', 'access control', 'permission', 'role',
  'admin', 'security', 'vulnerability', 'injection', 'xss', 'csrf',
];

const PERFORMANCE_KEYWORDS = [
  'performance', 'speed', 'latency', 'throughput', 'response time',
  'load', 'concurrent', 'scalability', 'cache', 'optimization',
];

export const generateTestCasesFromRequirement = async (requirementText, userId, projectId) => {
  const startTime = Date.now();

  try {
    const settings = await getAISettings(userId, projectId);
    const defaultPrompt = `
You are a Senior QA Engineer (ISTQB Advanced, 10+ years). Analyze the requirement and produce HIGH-ACCURACY test cases that a professional QA team would write.

Requirement:
"""
{{requirementText}}
"""

Generate 6-10 test cases covering:
- Happy path / functional
- Negative (invalid/missing data)
- Boundary value analysis (min/max/just-inside/just-outside)
- Security (authn/authz, injection, session) when relevant
- At least one edge/error-recovery case

QUALITY RULES (mandatory):
1. Scenario must be specific and measurable (not "verify the system works").
2. Preconditions must be concrete and environment-ready.
3. Steps must be atomic, numbered actions a tester can execute without guessing (include example test data in quotes).
4. Expected Results must be observable (UI message, status code, persisted state, redirect).
5. Priority: High for security/auth/payment/data-loss risks; Medium otherwise; Low for cosmetic.
6. Category must be one of: functional, negative, edge, security, boundary.
7. Trace each case clearly to the requirement intent.
8. Avoid vague words (appropriate, fast, user-friendly, etc.).

Return ONLY a JSON array of objects with keys:
scenario, preconditions (array of strings), steps (array of strings), expectedResults (string), priority, category
`;

    const prompt =
      (await resolvePromptForAction(userId, projectId, 'generate_test_cases', { requirementText })) ||
      defaultPrompt.replaceAll('{{requirementText}}', requirementText);

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 3500, {
      model: settings.model || undefined,
      temperature: typeof settings.temperature === 'number' ? Math.min(settings.temperature, 0.35) : 0.25,
      systemPrompt: settings.systemPrompt || 'You are a Senior QA Engineer writing ISTQB-compliant, production-grade test cases. Be precise, measurable, and complete.',
    });
    const testCases = await llmService.parseJSON(response.content);

    // Save test cases to database
    const savedTestCases = [];
    const now = new Date();

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const testCase = new TestCase({
        userId,
        projectId,
        testCaseId: `TC-${Date.now()}-${i}`,
        scenario: tc.scenario,
        preconditions: tc.preconditions || [],
        steps: tc.steps || [],
        expectedResults: tc.expectedResults,
        priority: tc.priority || 'Medium',
        category: tc.category || 'functional',
        riskScore: calculateRiskScore(tc),
        status: 'Draft',
      });

      await testCase.save();
      savedTestCases.push(testCase);
    }

    // Log AI action
    await AILog.create({
      userId,
      action: 'generate_test_cases',
      inputText: requirementText,
      inputLength: requirementText.length,
      outputLength: JSON.stringify(testCases).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
      tokensUsed: response.tokens,
    });

    logger.info(`Generated ${savedTestCases.length} test cases for requirement`);

    return savedTestCases;
  } catch (error) {
    logger.error(`Error generating test cases: ${error.message}`);

    await AILog.create({
      userId,
      action: 'generate_test_cases',
      inputText: requirementText,
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const detectAmbiguities = async (requirementText, userId, projectId = 'default') => {
  const startTime = Date.now();

  try {
    const ambiguities = [];

    // Local detection using keyword matching
    const words = requirementText.toLowerCase().split(/\s+/);
    let currentPos = 0;

    for (const word of words) {
      const foundVagueWord = VAGUE_WORDS.find(v => word.includes(v.toLowerCase()));

      if (foundVagueWord) {
        ambiguities.push({
          phrase: foundVagueWord,
          reason: 'Vague or ambiguous language detected',
          suggestion: `Clarify what exactly you mean by "${foundVagueWord}" with specific metrics or examples`,
          severity: 'medium',
          lineNumber: currentPos,
        });
      }

      currentPos += word.length + 1;
    }

    // Use AI for deeper analysis if needed
    if (ambiguities.length < 5 && requirementText.length > 200) {
      const settings = await getAISettings(userId, projectId);
      const defaultPrompt = `
      Identify any ambiguous, vague, or unclear phrases in this requirement.
      For each issue, provide: phrase, reason, suggestion for clarification.
      
      Requirement: "{{requirementText}}"
      
      Return as JSON array with objects containing: phrase, reason, suggestion, severity
      `;

      const prompt =
        (await resolvePromptForAction(userId, projectId, 'detect_ambiguities', { requirementText })) ||
        defaultPrompt.replaceAll('{{requirementText}}', requirementText);

      const response = await llmService.generateCompletion(prompt, Math.min(2000, settings.maxTokens || 1000), {
        model: settings.model || undefined,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
      });
      const aiAmbiguities = await llmService.parseJSON(response.content);

      ambiguities.push(...aiAmbiguities);
    }

    // Log AI action
    await AILog.create({
      userId,
      action: 'detect_ambiguities',
      inputText: requirementText,
      inputLength: requirementText.length,
      outputLength: JSON.stringify(ambiguities).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Detected ${ambiguities.length} ambiguities`);

    return ambiguities;
  } catch (error) {
    logger.error(`Error detecting ambiguities: ${error.message}`);

    await AILog.create({
      userId,
      action: 'detect_ambiguities',
      inputText: requirementText,
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const prioritizeTestCases = async (testCaseIds, userId) => {
  const startTime = Date.now();

  try {
    const testCases = await TestCase.find({ _id: { $in: testCaseIds } });

    const settings = await getAISettings(userId, 'default');
    const payload = JSON.stringify(
      testCases.map((tc) => ({
        id: tc._id,
        scenario: tc.scenario,
        category: tc.category,
      }))
    );

    const defaultPrompt = `
    Analyze these test cases and assign priorities (High/Medium/Low) based on:
    1. Business criticality
    2. Security keywords present
    3. Frequency of use
    4. Regression risk
    
    Test cases: {{testCasesJson}}
    
    Return as JSON array with: testCaseId, assignedPriority, reasoning
    `;

    const prompt =
      (await resolvePromptForAction(userId, 'default', 'prioritize_tests', { testCasesJson: payload })) ||
      defaultPrompt.replaceAll('{{testCasesJson}}', payload);

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
    });
    const priorities = await llmService.parseJSON(response.content);

    // Update test cases with priorities
    for (const priority of priorities) {
      await TestCase.findByIdAndUpdate(
        priority.testCaseId,
        { priority: priority.assignedPriority }
      );
    }

    await AILog.create({
      userId,
      action: 'prioritize_tests',
      inputLength: testCases.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Prioritized ${testCases.length} test cases`);

    return priorities;
  } catch (error) {
    logger.error(`Error prioritizing test cases: ${error.message}`);

    await AILog.create({
      userId,
      action: 'prioritize_tests',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

function calculateRiskScore(testCase) {
  let score = 50;

  if (testCase.category === 'security') score += 30;
  if (testCase.category === 'negative') score += 20;
  if (testCase.priority === 'High') score += 15;

  return Math.min(score, 100);
}

// ─── Feature 1: Requirement Change Impact Predictor ───────────────────────────
export const analyzeChangeImpact = async (oldRequirement, newRequirement, userId, projectId) => {
  const startTime = Date.now();

  try {
    // Fetch all test cases for this project to give AI context
    const testCases = await TestCase.find({ userId, projectId }).lean();
    const tcSummaries = testCases.map((tc) => ({
      testCaseId: tc.testCaseId,
      scenario: tc.scenario,
      category: tc.category,
      priority: tc.priority,
    }));

    const settings = await getAISettings(userId, projectId);

    const defaultPrompt = `
You are an expert QA engineer. A software requirement has been updated. Your job is to identify which existing test cases are affected by this change.

OLD REQUIREMENT:
"{{oldRequirement}}"

NEW REQUIREMENT:
"{{newRequirement}}"

EXISTING TEST CASES:
{{testCasesJson}}

Analyze the differences between the old and new requirement. For each test case that is affected by the change, return an entry.

Return ONLY a valid JSON object with this structure:
{
  "impactLevel": "High" | "Medium" | "Low" | "None",
  "reason": "Brief summary of what changed and why it matters",
  "affected": [
    {
      "testCaseId": "TC-xxx",
      "scenario": "...",
      "impact": "High" | "Medium" | "Low",
      "reason": "Specific reason this test case is affected",
      "regressionPriority": "Immediate" | "Next Sprint" | "Low Priority"
    }
  ]
}

If no test cases are affected return an empty "affected" array with impactLevel "None".
    `;

    const prompt =
      (await resolvePromptForAction(userId, projectId, 'change_impact', {
        oldRequirement,
        newRequirement,
        testCasesJson: JSON.stringify(tcSummaries),
      })) ||
      defaultPrompt
        .replaceAll('{{oldRequirement}}', oldRequirement)
        .replaceAll('{{newRequirement}}', newRequirement)
        .replaceAll('{{testCasesJson}}', JSON.stringify(tcSummaries));

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
    });

    let parsed;
    try {
      parsed = await llmService.parseJSON(response.content);
    } catch {
      parsed = { impactLevel: 'Low', reason: 'Could not parse AI response', affected: [] };
    }

    const affected = Array.isArray(parsed.affected) ? parsed.affected : [];
    const impactLevel = parsed.impactLevel || (affected.length > 0 ? 'Medium' : 'None');
    const reason = parsed.reason || '';

    // Persist to MongoDB
    const doc = await RequirementImpact.create({
      userId,
      projectId,
      oldRequirement,
      newRequirement,
      affectedTestCases: affected,
      impactLevel,
      reason,
      totalAffected: affected.length,
    });

    await AILog.create({
      userId,
      action: 'change_impact',
      inputText: `OLD: ${oldRequirement.substring(0, 100)} | NEW: ${newRequirement.substring(0, 100)}`,
      inputLength: oldRequirement.length + newRequirement.length,
      outputLength: JSON.stringify(affected).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
      tokensUsed: response.tokens,
    });

    logger.info(`Change impact analysis: ${affected.length} affected test cases`);
    return doc;
  } catch (error) {
    logger.error(`Error analysing change impact: ${error.message}`);
    await AILog.create({
      userId,
      action: 'change_impact',
      inputText: oldRequirement.substring(0, 200),
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });
    throw error;
  }
};

// ─── Feature 2: AI Test Data Generator ────────────────────────────────────────
export const generateTestData = async (requirement, userId, projectId, extraOptions = {}) => {
  const startTime = Date.now();
  const { testCaseId = '', testCaseTitle = '', selectedCategories = [] } = extraOptions;

  try {
    const settings = await getAISettings(userId, projectId);

    const defaultPrompt = `
You are an expert software testing specialist. Given the following requirement and test case context, generate comprehensive, realistic test data across categories.

TEST CASE: "${testCaseId || 'TC-DATA'} - ${testCaseTitle || 'Target Scenario'}"
REQUIREMENT CONTEXT:
"{{requirement}}"

Generate realistic, specific, and useful test data values (not descriptions — actual concrete strings/values).

Return ONLY a valid JSON object with exactly these keys:
{
  "valid": ["...", "..."],
  "invalid": ["...", "..."],
  "boundary": ["...", "..."],
  "edge": ["...", "..."],
  "security": ["...", "..."]
}

Each array must have 4-6 concrete data values. For "security", include payloads like SQL injection, XSS, empty strings, etc.
    `;

    const prompt =
      (await resolvePromptForAction(userId, projectId, 'generate_test_data', { requirement })) ||
      defaultPrompt.replaceAll('{{requirement}}', requirement);

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
    });

    let parsed;
    try {
      parsed = await llmService.parseJSON(response.content);
    } catch {
      parsed = { valid: [], invalid: [], boundary: [], edge: [], security: [] };
    }

    const safeArr = (v) => (Array.isArray(v) ? v.map(String) : []);
    const validArr = safeArr(parsed.valid);
    const invalidArr = safeArr(parsed.invalid);
    const boundaryArr = safeArr(parsed.boundary);
    const edgeArr = safeArr(parsed.edge);
    const securityArr = safeArr(parsed.security);

    // Build structured items
    const structuredItems = [];
    let tdIdx = 1;

    const pushItem = (val, cat, expVal, expOut, bnd) => {
      structuredItems.push({
        testDataId: `TD-${String(tdIdx++).padStart(4, '0')}`,
        relatedTestCaseId: testCaseId || 'TC-001',
        fieldName: /email/i.test(val) ? 'email' : /pass/i.test(val) ? 'password' : 'inputField',
        value: String(val),
        category: cat,
        expectedValidation: expVal,
        expectedOutcome: expOut,
        boundaryClassification: bnd,
        requirementReference: requirement.substring(0, 100),
      });
    };

    validArr.forEach((v) => pushItem(v, 'Valid Inputs', 'Accept valid format', '200 OK / Success State', 'Within Limits'));
    invalidArr.forEach((v) => pushItem(v, 'Invalid Inputs', 'Reject with 400 Bad Request', 'Validation Error Displayed', 'Invalid Schema'));
    boundaryArr.forEach((v) => pushItem(v, 'Boundary Values', 'Validate boundary thresholds', 'Boundary Accepted or Guarded', 'Exact Edge'));
    edgeArr.forEach((v) => pushItem(v, 'Edge Cases', 'Handle unexpected input lengths/types', 'Graceful Error Recovery', 'Corner Case'));
    securityArr.forEach((v) => pushItem(v, 'Security Payloads', 'Sanitize / Block injection', '403 Forbidden / Neutralized', 'Inert Vector'));

    const doc = await GeneratedTestData.create({
      userId,
      projectId,
      requirement,
      testCaseId: testCaseId || '',
      testCaseTitle: testCaseTitle || '',
      selectedCategories: selectedCategories || [],
      structuredItems,
      valid: validArr,
      invalid: invalidArr,
      boundary: boundaryArr,
      edge: edgeArr,
      security: securityArr,
    });

    await AILog.create({
      userId,
      action: 'generate_test_data',
      inputText: requirement.substring(0, 200),
      inputLength: requirement.length,
      outputLength: JSON.stringify(parsed).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
      tokensUsed: response.tokens,
    });

    const totalItems =
      doc.valid.length + doc.invalid.length + doc.boundary.length + doc.edge.length + doc.security.length;
    logger.info(`Generated ${totalItems} test data items (with ${structuredItems.length} structured items)`);
    return doc;
  } catch (error) {
    logger.error(`Error generating test data: ${error.message}`);
    await AILog.create({
      userId,
      action: 'generate_test_data',
      inputText: requirement.substring(0, 200),
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });
    throw error;
  }
};

// ─── Feature 3: Conversational Test Case Chatbot ──────────────────────────────
export const chatTestCase = async (sessionId, messageText, userId, projectId) => {
  const startTime = Date.now();
  let session = null;
  const actualSessionId = sessionId || `CHAT-${Date.now()}`;

  try {
    session = await ChatSession.findOne({ sessionId: actualSessionId, userId, projectId });
    if (!session) {
      session = new ChatSession({
        userId,
        projectId,
        sessionId: actualSessionId,
        messages: [],
        generatedTestCases: [],
        status: 'active',
      });
    }

    const saveRegex = /^\s*(save|save this|store these|save test cases)\s*$/i;
    const clearRegex = /^\s*(clear|new chat|reset|clear conversation)\s*$/i;

    if (saveRegex.test(messageText)) {
      session.messages.push({ role: 'user', content: messageText, timestamp: new Date() });
      session.messages.push({
        role: 'assistant',
        content: 'I have saved the test cases to your project successfully.',
        timestamp: new Date(),
      });
      session.status = 'saved';
      await session.save();
      await saveChatTestCases(actualSessionId, userId, projectId);
      
      await AILog.create({
        userId,
        action: 'chat_testcase_save',
        inputText: messageText,
        inputLength: messageText.length,
        outputLength: 0,
        status: 'Success',
        executionTime: Date.now() - startTime,
        tokensUsed: { total: 0 },
      });
      
      return { session, reply: 'I have saved the test cases to your project successfully.', saved: true, intent: 'SAVE' };
    }

    if (clearRegex.test(messageText)) {
      // Create a new session instead of wiping the old one to preserve history
      const newSessionId = `CHAT-${Date.now()}`;
      session = new ChatSession({
        userId,
        projectId,
        sessionId: newSessionId,
        messages: [{ role: 'user', content: messageText, timestamp: new Date() }, { role: 'assistant', content: 'Conversation cleared. What would you like to test next?', timestamp: new Date() }],
        generatedTestCases: [],
        status: 'active',
      });
      await session.save();
      
      return { session, reply: 'Conversation cleared.', saved: false, intent: 'CLEAR' };
    }

    const historyText = session.messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const testCasesContext = JSON.stringify(session.generatedTestCases.map((tc) => ({
      scenario: tc.scenario,
      preconditions: tc.preconditions,
      steps: tc.steps,
      expectedResults: tc.expectedResults,
      priority: tc.priority,
      category: tc.category,
    })), null, 2);

    const settings = await getAISettings(userId, projectId);

    const systemPrompt = `You are a Senior QA Engineer, ISTQB Certified Test Lead, and Automation Architect with 15+ years of experience. You act as an AI QA Assistant.
Your task is to analyze the user's message, classify their intent, and respond appropriately.

GUIDELINES:
1. Always understand user intent before acting.
2. If there are no previous test cases and the user asks for tests, generate fresh test cases.
3. If previous test cases exist, NEVER regenerate everything from scratch unless requested. UPDATE ONLY the requested sections of the CURRENT TEST CASES. Preserve existing work.
4. Generate production-quality outputs following professional ISTQB standards and IEEE style test cases.
5. Include Functional, Negative, Boundary, Security, Performance, Usability, API, Database, Regression, Compatibility, and Accessibility tests when requested.
6. You MUST ALWAYS return ONLY a valid JSON object. Never return markdown. Never return plain text.
7. If your intent is GREETING, GENERAL_CHAT, HELP, QUESTION, or UNKNOWN, you MUST return the exact same CURRENT TEST CASES in the "testCases" array. DO NOT return an empty array unless the current state is empty.

SUPPORTED INTENTS & RULES:
- GREETING: User says Hi, Hello, Hey, Good Morning. Reply naturally (e.g., "Hello! I am your AI Testing Assistant. I can help you generate Test Cases, API Tests, Automation Scripts, Boundary Tests, Negative Tests, Security Tests, and Risk Analysis. What would you like to test today?"). Do NOT generate test cases.
- NEW_TESTCASE: User wants to generate fresh test cases.
- REFINE_TESTCASE: User wants to modify existing test cases (e.g., "Add negative cases", "Make steps detailed").
- GENERATE_AUTOMATION: User wants automation scripts.
- GENERATE_NEGATIVE / GENERATE_BOUNDARY / GENERATE_API_TESTS / GENERATE_SECURITY: Add specific test types.
- QUESTION: User asks a software testing question. Answer professionally in the "reply" field without modifying test cases.
- GENERAL_CHAT: User says Thanks, OK, etc. Reply normally without generating test cases.
- UNKNOWN: Cannot determine intent.

JSON OUTPUT FORMAT:
{
  "intent": "GREETING | NEW_TESTCASE | REFINE_TESTCASE | GENERATE_AUTOMATION | GENERATE_NEGATIVE | GENERATE_BOUNDARY | GENERATE_API_TESTS | GENERATE_SECURITY | SAVE | CLEAR | HELP | GENERAL_CHAT | QUESTION | UNKNOWN",
  "reply": "Your conversational, natural reply to the user. Do not say 'Updated test cases' if generating new ones.",
  "testCases": [
    {
      "scenario": "...",
      "preconditions": ["...", "..."],
      "steps": ["...", "..."],
      "expectedResults": "...",
      "priority": "High" | "Medium" | "Low",
      "category": "functional" | "negative" | "edge" | "security" | "boundary" | "performance" | "integration"
    }
  ],
  "save": false
}`;

    const prompt = `CONVERSATION HISTORY:
${historyText || 'No previous messages.'}

CURRENT TEST CASES (STATE):
${testCasesContext || '[]'}

USER'S LATEST REQUEST:
"${messageText}"`;

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature || 0.7,
      systemPrompt: systemPrompt,
    });

    let parsed;
    try {
      parsed = await llmService.parseJSON(response.content);
    } catch {
      parsed = {
        intent: 'UNKNOWN',
        reply: "I ran into an issue parsing the response, but I tried to keep the existing test cases intact.",
        testCases: session.generatedTestCases,
        save: false
      };
    }

    const reply = parsed.reply || 'Here is the response.';
    const testCases = Array.isArray(parsed.testCases) ? parsed.testCases : session.generatedTestCases;

    session.messages.push({ role: 'user', content: messageText, timestamp: new Date() });
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date() });
    session.generatedTestCases = testCases.map((tc) => ({
      scenario: tc.scenario || 'New Test Case',
      preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
      steps: Array.isArray(tc.steps) ? tc.steps : [],
      expectedResults: tc.expectedResults || tc.expectedResult || '',
      priority: ['High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
      category: ['functional', 'negative', 'edge', 'security', 'boundary', 'performance', 'integration'].includes((tc.category || '').toLowerCase()) ? tc.category.toLowerCase() : 'functional',
      status: 'Draft',
    }));

    await session.save();

    let saved = false;
    if (parsed.save || parsed.intent === 'SAVE') {
      await saveChatTestCases(actualSessionId, userId, projectId);
      saved = true;
    }

    await AILog.create({
      userId,
      action: 'chat_testcase',
      inputText: messageText.substring(0, 200),
      inputLength: messageText.length,
      outputLength: JSON.stringify(parsed).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
      tokensUsed: response.tokens,
    });
    
    logger.info(`Chat TestCase - Intent: ${parsed.intent}, Length: ${session.messages.length}`);

    return {
      session,
      reply,
      saved,
      intent: parsed.intent,
    };
  } catch (error) {
    logger.error(`Error in chatTestCase service: ${error.message}`);
    await AILog.create({
      userId,
      action: 'chat_testcase',
      inputText: messageText.substring(0, 200),
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });
    throw error;
  }
};

// ─── Streaming version of chatTestCase ────────────────────────────────────────
export const chatTestCaseStream = async (sessionId, messageText, userId, projectId, onChunk) => {
  const startTime = Date.now();
  let session = null;
  const actualSessionId = sessionId || `CHAT-${Date.now()}`;

  try {
    session = await ChatSession.findOne({ sessionId: actualSessionId, userId, projectId });
    if (!session) {
      session = new ChatSession({
        userId,
        projectId,
        sessionId: actualSessionId,
        messages: [],
        generatedTestCases: [],
        status: 'active',
      });
    }

    // Handle save/clear the same as non-streaming
    const saveRegex = /^\s*(save|save this|store these|save test cases)\s*$/i;
    const clearRegex = /^\s*(clear|new chat|reset|clear conversation)\s*$/i;

    if (saveRegex.test(messageText)) {
      session.messages.push({ role: 'user', content: messageText, timestamp: new Date() });
      session.messages.push({
        role: 'assistant',
        content: 'I have saved the test cases to your project successfully.',
        timestamp: new Date(),
      });
      session.status = 'saved';
      await session.save();
      await saveChatTestCases(actualSessionId, userId, projectId);
      onChunk('I have saved the test cases to your project successfully.');
      return { session, reply: 'I have saved the test cases to your project successfully.', saved: true, intent: 'SAVE' };
    }

    if (clearRegex.test(messageText)) {
      const newSessionId = `CHAT-${Date.now()}`;
      session = new ChatSession({
        userId,
        projectId,
        sessionId: newSessionId,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: 'Conversation cleared. What would you like to test next?', timestamp: new Date() },
        ],
        generatedTestCases: [],
        status: 'active',
      });
      await session.save();
      onChunk('Conversation cleared. What would you like to test next?');
      return { session, reply: 'Conversation cleared.', saved: false, intent: 'CLEAR' };
    }

    const historyText = session.messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const testCasesContext = JSON.stringify(session.generatedTestCases.map((tc) => ({
      scenario: tc.scenario,
      preconditions: tc.preconditions,
      steps: tc.steps,
      expectedResults: tc.expectedResults,
      priority: tc.priority,
      category: tc.category,
    })), null, 2);

    const settings = await getAISettings(userId, projectId);

    const systemPrompt = `You are a Senior QA Engineer, ISTQB Certified Test Lead, and Automation Architect with 15+ years of experience. You act as an AI QA Assistant.
Your task is to analyze the user's message, classify their intent, and respond appropriately.

GUIDELINES:
1. Always understand user intent before acting.
2. If there are no previous test cases and the user asks for tests, generate fresh test cases.
3. If previous test cases exist, NEVER regenerate everything from scratch unless requested. UPDATE ONLY the requested sections of the CURRENT TEST CASES. Preserve existing work.
4. Generate production-quality outputs following professional ISTQB standards and IEEE style test cases.
5. Include Functional, Negative, Boundary, Security, Performance, Usability, API, Database, Regression, Compatibility, and Accessibility tests when requested.
6. You MUST ALWAYS return ONLY a valid JSON object. Never return markdown. Never return plain text.
7. If your intent is GREETING, GENERAL_CHAT, HELP, QUESTION, or UNKNOWN, you MUST return the exact same CURRENT TEST CASES in the "testCases" array. DO NOT return an empty array unless the current state is empty.

SUPPORTED INTENTS & RULES:
- GREETING: User says Hi, Hello, Hey, Good Morning. Reply naturally. Do NOT generate test cases.
- NEW_TESTCASE: User wants to generate fresh test cases.
- REFINE_TESTCASE: User wants to modify existing test cases.
- GENERATE_AUTOMATION: User wants automation scripts.
- GENERATE_NEGATIVE / GENERATE_BOUNDARY / GENERATE_API_TESTS / GENERATE_SECURITY: Add specific test types.
- QUESTION: User asks a software testing question.
- GENERAL_CHAT: User says Thanks, OK, etc.
- UNKNOWN: Cannot determine intent.

JSON OUTPUT FORMAT:
{
  "intent": "GREETING | NEW_TESTCASE | REFINE_TESTCASE | ...",
  "reply": "Your conversational reply",
  "testCases": [
    {
      "scenario": "...",
      "preconditions": ["..."],
      "steps": ["..."],
      "expectedResults": "...",
      "priority": "High" | "Medium" | "Low",
      "category": "functional" | "negative" | "edge" | "security" | "boundary" | "performance" | "integration"
    }
  ],
  "save": false
}`;

    const prompt = `CONVERSATION HISTORY:
${historyText || 'No previous messages.'}

CURRENT TEST CASES (STATE):
${testCasesContext || '[]'}

USER'S LATEST REQUEST:
"${messageText}"`;

    // Stream the response, sending chunks as they arrive
    let fullContent = '';
    const stream = llmService.generateCompletionStream(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature || 0.7,
      systemPrompt: systemPrompt,
    });

    let sentReplyLength = 0;
    for await (const chunk of stream) {
      fullContent += chunk;

      // Extract progressive 'reply' string from JSON stream to prevent raw JSON syntax leakage
      const match = fullContent.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
      if (match && match[1]) {
        const replySoFar = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');

        if (replySoFar.length > sentReplyLength) {
          const newChunk = replySoFar.slice(sentReplyLength);
          sentReplyLength = replySoFar.length;
          onChunk(newChunk);
        }
      } else if (!fullContent.trim().startsWith('{')) {
        onChunk(chunk);
      }
    }

    let parsed;
    try {
      parsed = await llmService.parseJSON(fullContent);
    } catch {
      parsed = {
        intent: 'UNKNOWN',
        reply: fullContent || "I ran into an issue parsing the response, but I tried to keep the existing test cases intact.",
        testCases: session.generatedTestCases,
        save: false
      };
    }

    const reply = parsed.reply || 'Here is the response.';
    const testCases = Array.isArray(parsed.testCases) ? parsed.testCases : session.generatedTestCases;

    session.messages.push({ role: 'user', content: messageText, timestamp: new Date() });
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date() });
    session.generatedTestCases = testCases.map((tc) => ({
      scenario: tc.scenario || 'New Test Case',
      preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
      steps: Array.isArray(tc.steps) ? tc.steps : [],
      expectedResults: tc.expectedResults || tc.expectedResult || '',
      priority: ['High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
      category: ['functional', 'negative', 'edge', 'security', 'boundary', 'performance', 'integration'].includes((tc.category || '').toLowerCase()) ? tc.category.toLowerCase() : 'functional',
      status: 'Draft',
    }));

    await session.save();

    let saved = false;
    if (parsed.save || parsed.intent === 'SAVE') {
      await saveChatTestCases(actualSessionId, userId, projectId);
      saved = true;
    }

    await AILog.create({
      userId,
      action: 'chat_testcase',
      inputText: messageText.substring(0, 200),
      inputLength: messageText.length,
      outputLength: fullContent.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
      tokensUsed: {},
    });

    logger.info(`Chat TestCase Stream - Intent: ${parsed.intent}, Length: ${session.messages.length}`);

    return { session, reply, saved, intent: parsed.intent };
  } catch (error) {
    logger.error(`Error in chatTestCaseStream service: ${error.message}`);
    await AILog.create({
      userId,
      action: 'chat_testcase',
      inputText: messageText.substring(0, 200),
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });
    throw error;
  }
};

export const saveChatTestCases = async (sessionId, userId, projectId) => {
  const session = await ChatSession.findOne({ sessionId, userId, projectId });
  if (!session) {
    throw new Error('Chat session not found');
  }

  const savedTestCases = [];
  for (let i = 0; i < session.generatedTestCases.length; i++) {
    const tc = session.generatedTestCases[i];
    // Skip duplicates already saved for this user/project with same scenario + expected results
    const existing = await TestCase.findOne({
      userId,
      projectId,
      scenario: tc.scenario,
      expectedResults: tc.expectedResults,
    }).select('_id testCaseId');

    if (existing) {
      savedTestCases.push(existing);
      continue;
    }

    const testCase = new TestCase({
      userId,
      projectId,
      testCaseId: `TC-CHAT-${Date.now()}-${i}`,
      scenario: tc.scenario,
      preconditions: tc.preconditions || [],
      steps: tc.steps || [],
      expectedResults: tc.expectedResults,
      priority: tc.priority || 'Medium',
      category: tc.category || 'functional',
      status: 'Draft',
    });

    await testCase.save();
    savedTestCases.push(testCase);
  }

  session.status = 'saved';
  await session.save();

  await AILog.create({
    userId,
    action: 'save_chat_testcases',
    inputText: `Saved session ${sessionId}`,
    inputLength: sessionId.length,
    outputLength: JSON.stringify(savedTestCases).length,
    status: 'Success',
    executionTime: 0,
    tokensUsed: { total: 0 },
  });

  logger.info(`Saved ${savedTestCases.length} test cases from chat session ${sessionId}`);
  return savedTestCases;
};

export const getChatSession = async (sessionId, userId, projectId) => {
  const session = await ChatSession.findOne({ sessionId, userId, projectId }).lean();
  return session;
};

