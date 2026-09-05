import { Router } from 'express';
import { TemporalController } from '../controllers/temporal.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/cases/:id/timeline', authenticate, TemporalController.getCaseTimeline);
router.get('/cases/:id/temporal-analysis', authenticate, TemporalController.getCaseTemporalAnalysis);
router.get('/timeline', authenticate, TemporalController.getTimelineEvents);

export default router;
