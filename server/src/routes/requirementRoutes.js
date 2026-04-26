import express from 'express';
import * as requirementController from '../controllers/requirementController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, requirementController.createRequirement);
router.get('/', authenticate, requirementController.getRequirements);
router.get('/:id', authenticate, requirementController.getRequirementById);
router.put('/:id', authenticate, requirementController.updateRequirement);
router.delete('/:id', authenticate, requirementController.deleteRequirement);

export default router;
