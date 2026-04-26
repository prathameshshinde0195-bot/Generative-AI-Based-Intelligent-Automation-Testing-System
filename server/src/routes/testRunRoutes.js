import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as testRunController from '../controllers/testRunController.js';

const router = express.Router();

router.post('/', authenticate, testRunController.createTestRun);
router.get('/', authenticate, testRunController.listTestRuns);
router.get('/:runId', authenticate, testRunController.getTestRun);
router.get('/:runId/stream', testRunController.streamTestRun);
router.post('/:runId/execute', authenticate, testRunController.executeTestRun);
router.post('/:runId/cancel', authenticate, testRunController.cancelTestRun);

export default router;

