import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/generate', authenticate, ReportController.generateReport);
router.get('/', authenticate, ReportController.listReports);
router.get('/:id', authenticate, ReportController.getReport);
router.get('/:id/download', authenticate, ReportController.downloadReport);

export default router;
