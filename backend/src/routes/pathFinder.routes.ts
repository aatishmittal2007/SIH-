import { Router } from 'express';
import { PathFinderController } from '../controllers/pathFinder.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/path-finder', PathFinderController.findPaths);

export default router;
