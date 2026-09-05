import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { validate } from '../../middleware/validate.middleware';
import { SourceController } from './source.controller';
import { createSourceSchema, updateSourceSchema } from './source.schema';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(SourceController.getAll));
router.get('/:id', asyncHandler(SourceController.getById));
router.post('/', authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]), validate(createSourceSchema), asyncHandler(SourceController.create));
router.patch('/:id', authorize([UserRole.ADMIN, UserRole.INVESTIGATOR]), validate(updateSourceSchema), asyncHandler(SourceController.update));

export const sourceRoutes = router;
