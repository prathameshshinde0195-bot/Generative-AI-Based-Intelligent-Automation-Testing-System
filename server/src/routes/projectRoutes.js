import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as projectController from '../controllers/projectController.js';

const router = express.Router();

router.get('/', authenticate, projectController.listProjects);
router.post('/', authenticate, projectController.createProject);
router.put('/:projectId', authenticate, projectController.updateProject);
router.delete('/:projectId', authenticate, projectController.deleteProject);

export default router;

