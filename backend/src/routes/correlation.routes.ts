import { Router } from 'express';
import { CorrelationController } from '../controllers/correlation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/run', authenticate, authorizeRoles(UserRole.ADMIN, UserRole.INVESTIGATOR), CorrelationController.runCorrelation);
router.get('/', authenticate, CorrelationController.getCorrelations);
router.get('/:id', authenticate, CorrelationController.getCorrelationById);
router.get('/case/:id', authenticate, CorrelationController.getCaseCorrelations);

export default router;
