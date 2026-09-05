import { Router } from 'express';
import { RelationshipController } from '../controllers/relationship.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/rebuild', authenticate, authorizeRoles(UserRole.ADMIN, UserRole.INVESTIGATOR), RelationshipController.rebuildRelationships);
router.get('/entities/:id', authenticate, RelationshipController.getEntityRelationships);

export default router;
