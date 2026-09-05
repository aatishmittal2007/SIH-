import { Router } from 'express';
import multer from 'multer';
import { EvidenceController } from './evidence.controller';
import { ProvenanceController } from '../provenance/provenance.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

const uploadMiddleware = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  storage: multer.memoryStorage(),
});

// All routes require authentication
router.use(authenticate);

// Process raw text input
router.post(
  '/process-raw',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.processRawText)
);

// Upload evidence file (Support /upload endpoint as used in tests)
router.post(
  '/upload',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]),
  uploadMiddleware.single('file'),
  asyncHandler(EvidenceController.upload)
);

// Upload evidence file
router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]),
  uploadMiddleware.single('file'),
  asyncHandler(EvidenceController.upload)
);

// List evidence
router.get(
  '/',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.list)
);

// Get evidence by ID
router.get(
  '/:id/provenance',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(ProvenanceController.getEvidenceProvenance)
);

router.get(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.getById)
);

// Download evidence file
router.get(
  '/:id/download',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.download)
);

// Update evidence
router.put(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]),
  asyncHandler(EvidenceController.update)
);

// Delete evidence
router.delete(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]),
  asyncHandler(EvidenceController.delete)
);

// Trigger NLP/NER processing for evidence
router.post(
  '/:id/process',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.processEvidence)
);

// Get evidence processing status
router.get(
  '/:id/processing-status',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.getProcessingStatus)
);

// Get extracted text document
router.get(
  '/:id/extracted-text',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.getExtractedText)
);

// Get document chunks
router.get(
  '/:id/chunks',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.getChunks)
);

// Get extracted entity mentions
router.get(
  '/:id/entity-mentions',
  authorize([UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.ANALYST]),
  asyncHandler(EvidenceController.getEntityMentions)
);

export const evidenceRoutes = router;
export default router;
