import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { ProvenanceController } from './provenance.controller';

const router = Router();

router.use(authenticate);

router.get('/entity/:id', asyncHandler(ProvenanceController.getEntityProvenance));
router.get('/evidence/:id', asyncHandler(ProvenanceController.getEvidenceProvenance));
router.get('/case/:id', asyncHandler(ProvenanceController.getCaseProvenance));

export const provenanceRoutes = router;
