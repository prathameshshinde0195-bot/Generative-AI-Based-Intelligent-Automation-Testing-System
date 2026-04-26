import TestCase from '../models/TestCase.js';
import Requirement from '../models/Requirement.js';
import llmService from '../utils/llm-service.js';
import AILog from '../models/AILog.js';
import logger from '../utils/logger.js';
import { getAISettings, resolvePromptForAction } from './promptTemplateService.js';

export const generateAutomationScript = async (testCaseId, framework, userId) => {
  const startTime = Date.now();

  try {
    const testCase = await TestCase.findById(testCaseId);

    if (!testCase) {
      throw new Error('Test case not found');
    }

    const prompt = `
    Generate a ${framework} automation script for this test case.
    
    Test Case:
    - Scenario: ${testCase.scenario}
    - Preconditions: ${testCase.preconditions.join(', ')}
    - Steps: ${testCase.steps.join(', ')}
    - Expected Results: ${testCase.expectedResults}
    
    Provide complete, production-ready code with:
    1. Proper imports
    2. Setup and teardown
    3. Page objects if applicable
    4. Assertions
    5. Error handling
    6. Comments
    
    Framework: ${framework}
    `;

    const response = await llmService.generateCompletion(prompt, 3000);

    const scriptCode = extractCodeBlock(response.content);

    // Save automation script
    const automationScript = {
      userId,
      testCaseId,
      framework,
      language: getLanguageForFramework(framework),
      code: scriptCode,
      status: 'Created',
    };

    await AILog.create({
      userId,
      action: 'generate_script',
      inputLength: JSON.stringify(testCase).length,
      outputLength: scriptCode.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Generated automation script for test case ${testCaseId}`);

    return automationScript;
  } catch (error) {
    logger.error(`Error generating automation script: ${error.message}`);

    await AILog.create({
      userId,
      action: 'generate_script',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const detectDuplicateTestCases = async (testCaseIds, userId) => {
  const startTime = Date.now();

  try {
    const testCases = await TestCase.find({ _id: { $in: testCaseIds } });

    const duplicates = [];

    for (let i = 0; i < testCases.length; i++) {
      for (let j = i + 1; j < testCases.length; j++) {
        const similarity = calculateSimilarity(testCases[i], testCases[j]);

        if (similarity > 0.7) {
          duplicates.push({
            testCase1Id: testCases[i]._id,
            testCase2Id: testCases[j]._id,
            similarity: Math.round(similarity * 100),
            reason: generateSimilarityReason(testCases[i], testCases[j]),
          });
        }
      }
    }

    await AILog.create({
      userId,
      action: 'detect_duplicates',
      inputLength: testCases.length,
      outputLength: duplicates.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Found ${duplicates.length} duplicate test cases`);

    return duplicates;
  } catch (error) {
    logger.error(`Error detecting duplicates: ${error.message}`);

    await AILog.create({
      userId,
      action: 'detect_duplicates',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const generateNegativeTestCases = async (requirementText, userId, projectId) => {
  const startTime = Date.now();

  try {
    const settings = await getAISettings(userId, projectId);
    const defaultPrompt = `
    Generate 3-5 negative test cases for boundary conditions, invalid inputs, and edge cases.
    
    Based on requirement: "{{requirementText}}"
    
    For each test case provide:
    1. Scenario (focused on error/boundary conditions)
    2. Preconditions
    3. Steps with invalid/boundary inputs
    4. Expected Results (error handling)
    5. Category (negative or edge)
    
    Return as JSON array
    `;

    const prompt =
      (await resolvePromptForAction(userId, projectId, 'generate_negative_test_cases', { requirementText })) ||
      defaultPrompt.replaceAll('{{requirementText}}', requirementText);

    const response = await llmService.generateCompletion(prompt, settings.maxTokens || 2000, {
      model: settings.model || undefined,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
    });
    const negativeTestCases = await llmService.parseJSON(response.content);

    // Save negative test cases
    const savedCases = [];

    for (let i = 0; i < negativeTestCases.length; i++) {
      const tc = negativeTestCases[i];
      const testCase = new TestCase({
        userId,
        projectId,
        testCaseId: `NTC-${Date.now()}-${i}`,
        scenario: tc.scenario,
        preconditions: tc.preconditions || [],
        steps: tc.steps || [],
        expectedResults: tc.expectedResults,
        priority: 'Medium',
        category: tc.category || 'negative',
        status: 'Draft',
      });

      await testCase.save();
      savedCases.push(testCase);
    }

    await AILog.create({
      userId,
      action: 'generate_negative_cases',
      inputLength: requirementText.length,
      outputLength: JSON.stringify(negativeTestCases).length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Generated ${savedCases.length} negative test cases`);

    return savedCases;
  } catch (error) {
    logger.error(`Error generating negative test cases: ${error.message}`);

    await AILog.create({
      userId,
      action: 'generate_negative_cases',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

// Utility functions
function calculateSimilarity(tc1, tc2) {
  const s1 = (tc1.scenario + ' ' + tc1.steps.join(' ')).toLowerCase();
  const s2 = (tc2.scenario + ' ' + tc2.steps.join(' ')).toLowerCase();

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
  const costs = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}

function generateSimilarityReason(tc1, tc2) {
  return `Similar scenarios: "${tc1.scenario.substring(0, 50)}..." and "${tc2.scenario.substring(0, 50)}..."`;
}

function getLanguageForFramework(framework) {
  const map = {
    'selenium-java': 'Java',
    'selenium-python': 'Python',
    'cypress': 'JavaScript',
    'playwright': 'TypeScript',
  };
  return map[framework] || 'JavaScript';
}

function extractCodeBlock(content) {
  const codeMatch = content.match(/```(?:javascript|java|python|typescript)?\n([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : content;
}
