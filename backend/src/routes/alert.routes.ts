import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, AlertController.listAlerts);
router.post('/generate', authenticate, AlertController.generateAlerts);
router.patch('/:id', authenticate, AlertController.updateAlertStatus);

export default router;
