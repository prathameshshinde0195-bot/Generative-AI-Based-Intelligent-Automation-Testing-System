import express from 'express';
import * as testCaseController from '../controllers/testCaseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, testCaseController.createTestCase);
router.get('/', authenticate, testCaseController.getTestCases);
router.get('/export', authenticate, testCaseController.exportTestCases);
router.post('/bulk-delete', authenticate, testCaseController.bulkDeleteTestCases);
router.get('/:id', authenticate, testCaseController.getTestCaseById);
router.put('/:id', authenticate, testCaseController.updateTestCase);
router.delete('/:id', authenticate, testCaseController.deleteTestCase);

export default router;
