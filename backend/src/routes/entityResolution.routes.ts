import { Router } from 'express';
import { EntityResolutionController } from '../controllers/entityResolution.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Protect all routes with JWT token authentication
router.use(authenticateToken);

// GET /api/entity-resolution/candidates - query candidates
router.get('/candidates', EntityResolutionController.getCandidates);

// GET /api/entity-resolution/candidates/:id - get single candidate
router.get('/candidates/:id', EntityResolutionController.getCandidateById);

// POST /api/entity-resolution/generate - run candidate generation pipeline
router.post(
  '/generate',
  authorizeRoles('ADMIN', 'INVESTIGATOR'),
  EntityResolutionController.generateCandidates
);

// POST /api/entity-resolution/candidates/:id/confirm - confirm match
router.post(
  '/candidates/:id/confirm',
  authorizeRoles('ADMIN', 'INVESTIGATOR'),
  EntityResolutionController.confirmCandidateMatch
);

// POST /api/entity-resolution/candidates/:id/reject - reject match
router.post(
  '/candidates/:id/reject',
  authorizeRoles('ADMIN', 'INVESTIGATOR'),
  EntityResolutionController.rejectCandidateMatch
);

export default router;
