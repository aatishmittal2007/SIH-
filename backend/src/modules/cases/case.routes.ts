import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { validate } from '../../middleware/validate.middleware';
import { CaseController } from './case.controller';
import { createCaseSchema, updateCaseSchema, assignCaseSchema } from './case.schema';
import { UserRole } from '@prisma/client';
import { ProvenanceController } from '../provenance/provenance.controller';

const router = Router();

router.use(authenticate);

// Case management routes
router.get('/', asyncHandler(CaseController.getCases));
router.post('/', validate(createCaseSchema), asyncHandler(CaseController.createCase));
router.get('/:id/provenance', asyncHandler(ProvenanceController.getCaseProvenance));
router.get('/:id', asyncHandler(CaseController.getCaseById));
router.patch('/:id', validate(updateCaseSchema), asyncHandler(CaseController.updateCase));
router.delete('/:id', authorize([UserRole.ADMIN]), asyncHandler(CaseController.archiveCase));

// Case assignment routes
router.get('/:id/assignments', asyncHandler(CaseController.getAssignments));
router.post('/:id/assignments', validate(assignCaseSchema), asyncHandler(CaseController.assignUser));
router.delete('/:id/assignments/:userId', authorize([UserRole.ADMIN]), asyncHandler(CaseController.removeUserAssignment));

export const caseRoutes = router;
