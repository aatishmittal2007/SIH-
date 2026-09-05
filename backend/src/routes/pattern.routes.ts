import { Router } from 'express';
import { PatternController } from '../controllers/pattern.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/detect', authenticate, authorizeRoles(UserRole.ADMIN, UserRole.INVESTIGATOR), PatternController.runPatternDetection);
router.get('/', authenticate, PatternController.getPatterns);
router.get('/:id', authenticate, PatternController.getPatternById);

export default router;
