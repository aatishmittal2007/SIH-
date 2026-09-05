import { Router } from 'express';
import { IntelligenceController } from '../controllers/intelligence.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/generate', IntelligenceController.generateFindings);
router.get('/case/:caseId', IntelligenceController.getFindingsByCase);
router.get('/finding/:id', IntelligenceController.getFindingById);
router.get('/contradictions', IntelligenceController.getContradictions);
router.get('/anomalies', IntelligenceController.getAnomalies);
router.get('/shortest-path', IntelligenceController.getShortestPath);

export default router;
