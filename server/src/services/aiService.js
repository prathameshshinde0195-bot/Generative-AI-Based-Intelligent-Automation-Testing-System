import TestCase from '../models/TestCase.js';
import Requirement from '../models/Requirement.js';
import llmService from '../utils/llm-service.js';
import AILog from '../models/AILog.js';
import logger from '../utils/logger.js';
import { getAISettings, resolvePromptForAction } from './promptTemplateService.js';

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
    Analyze the following requirement and generate 5-7 detailed test cases.
    For each test case, provide:
    1. Scenario (brief description)
    2. Preconditions (list as array)
    3. Steps (list as array)
    4. Expected Results
    5. Priority (High/Medium/Low) based on importance
    6. Category (functional/negative/edge/security/boundary)
    
    Requirement: "{{requirementText}}"
    
    Return as JSON array with objects containing: scenario, preconditions, steps, expectedResults, priority, category
    `;

    const prompt =
      (await resolvePromptForAction(userId, projectId, 'generate_test_cases', { requirementText })) ||
      defaultPrompt.replaceAll('{{requirementText}}', requirementText);

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
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

export const prioritizeTestCases = async (testCaseIds, userId, projectId = 'default') => {
  const startTime = Date.now();

  try {
    const testCases = await TestCase.find({ _id: { $in: testCaseIds } });

    const settings = await getAISettings(userId, projectId);
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
      (await resolvePromptForAction(userId, projectId, 'prioritize_tests', { testCasesJson: payload })) ||
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
