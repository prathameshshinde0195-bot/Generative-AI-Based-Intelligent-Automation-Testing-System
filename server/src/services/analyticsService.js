import Requirement from '../models/Requirement.js';
import TestCase from '../models/TestCase.js';
import AILog from '../models/AILog.js';
import llmService from '../utils/llm-service.js';
import logger from '../utils/logger.js';

export const generateTraceabilityMatrix = async (userId, projectId) => {
  const startTime = Date.now();

  try {
    const requirements = await Requirement.find({ userId, projectId });
    const testCases = await TestCase.find({ userId, projectId });

    const matrix = [];

    for (const req of requirements) {
      const relatedTestCases = testCases.filter(tc => 
        tc.requirementId === req.requirementId || 
        tc.steps.some(step => step.toLowerCase().includes(req.title.toLowerCase()))
      );

      const coveragePercentage = relatedTestCases.length > 0 ? 100 : 0;

      matrix.push({
        requirementId: req.requirementId,
        requirementText: req.title,
        testCaseIds: relatedTestCases.map(tc => tc._id),
        testCount: relatedTestCases.length,
        coverage: coveragePercentage,
      });
    }

    await AILog.create({
      userId,
      action: 'create_traceability',
      inputLength: requirements.length,
      outputLength: matrix.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Generated traceability matrix for ${matrix.length} requirements`);

    return matrix;
  } catch (error) {
    logger.error(`Error generating traceability matrix: ${error.message}`);

    await AILog.create({
      userId,
      action: 'create_traceability',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const calculateCoverage = async (userId, projectId) => {
  const startTime = Date.now();

  try {
    const requirements = await Requirement.find({ userId, projectId });
    const testCases = await TestCase.find({ userId, projectId });

    const totalRequirements = requirements.length;
    const categoryBreakdown = {};

    let coveredCount = 0;
    const uncoveredReqs = [];

    for (const req of requirements) {
      const hasCoverage = testCases.some(tc =>
        tc.requirementId === req.requirementId ||
        tc.steps.some(step => step.includes(req.requirementId))
      );

      if (hasCoverage) {
        coveredCount++;
      } else {
        uncoveredReqs.push(req.requirementId);
      }
    }

    // Category breakdown
    for (const tc of testCases) {
      categoryBreakdown[tc.category] = (categoryBreakdown[tc.category] || 0) + 1;
    }

    const coverage = {
      totalRequirements,
      coveredRequirements: coveredCount,
      uncoveredRequirements: uncoveredReqs.length,
      coveragePercentage: totalRequirements > 0 ? Math.round((coveredCount / totalRequirements) * 100) : 0,
      missingRequirements: uncoveredReqs,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, count]) => ({
        category,
        count,
        percentage: testCases.length > 0 ? Math.round((count / testCases.length) * 100) : 0,
      })),
    };

    await AILog.create({
      userId,
      action: 'analyze_coverage',
      inputLength: totalRequirements,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Coverage: ${coverage.coveragePercentage}% (${coveredCount}/${totalRequirements})`);

    return coverage;
  } catch (error) {
    logger.error(`Error calculating coverage: ${error.message}`);

    await AILog.create({
      userId,
      action: 'analyze_coverage',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};

export const assessRisk = async (requirementText, testCases, userId) => {
  const startTime = Date.now();

  try {
    const prompt = `
    Assess the risk level for these components based on:
    1. Security keywords (authentication, encryption, etc.)
    2. Performance keywords (speed, load, scalability)
    3. Functional complexity
    4. Test coverage
    
    Requirement: "${requirementText}"
    Test cases count: ${testCases.length}
    
    Return JSON with: securityRisk, performanceRisk, functionalRisk (0-100), overallScore, factors[]
    `;

    const response = await llmService.generateCompletion(prompt);
    const riskAssessment = await llmService.parseJSON(response.content);

    await AILog.create({
      userId,
      action: 'assess_risk',
      inputLength: requirementText.length,
      status: 'Success',
      executionTime: Date.now() - startTime,
    });

    logger.info(`Risk assessment: ${riskAssessment.overallScore}/100`);

    return riskAssessment;
  } catch (error) {
    logger.error(`Error assessing risk: ${error.message}`);

    await AILog.create({
      userId,
      action: 'assess_risk',
      status: 'Failed',
      errorMessage: error.message,
      executionTime: Date.now() - startTime,
    });

    throw error;
  }
};
