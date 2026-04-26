import express from 'express';
import * as aiController from '../controllers/aiController.js';
import * as promptTemplateController from '../controllers/promptTemplateController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// AI settings & templates
router.get('/supported-actions', authenticate, promptTemplateController.getSupportedActions);
router.get('/settings', authenticate, promptTemplateController.getAISettings);
router.put('/settings', authenticate, authorize(['Admin', 'QA']), promptTemplateController.updateAISettings);
router.get('/templates', authenticate, promptTemplateController.listTemplates);
router.post('/templates', authenticate, authorize(['Admin', 'QA']), promptTemplateController.createTemplate);
router.put('/templates/:templateId', authenticate, authorize(['Admin', 'QA']), promptTemplateController.updateTemplate);
router.delete('/templates/:templateId', authenticate, authorize(['Admin', 'QA']), promptTemplateController.archiveTemplate);

router.post('/generate-test-cases', authenticate, aiLimiter, aiController.generateTestCases);
router.post('/detect-ambiguities', authenticate, aiLimiter, aiController.detectAmbiguities);
router.post('/prioritize-test-cases', authenticate, aiLimiter, aiController.prioritizeTestCases);
router.post('/generate-automation-script', authenticate, aiLimiter, aiController.generateAutomationScript);
router.post('/detect-duplicates', authenticate, aiLimiter, aiController.detectDuplicates);
router.post('/generate-negative-test-cases', authenticate, aiLimiter, aiController.generateNegativeTestCases);
router.get('/traceability-matrix', authenticate, aiController.getTraceabilityMatrix);
router.get('/coverage-analysis', authenticate, aiController.getCoverageAnalysis);
router.post('/assess-risk', authenticate, aiLimiter, aiController.assessRisk);
router.get('/dashboard-metrics', authenticate, aiController.getDashboardMetrics);

export default router;
