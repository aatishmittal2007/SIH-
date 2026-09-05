import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { validate } from '../../middleware/validate.middleware';
import { EntityController } from './entity.controller';
import {
  createEntitySchema,
  updateEntitySchema,
  linkEntityToCaseSchema,
  createEntityMentionSchema,
} from './entity.schema';
import { ProvenanceController } from '../provenance/provenance.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(EntityController.list));
router.post('/', validate(createEntitySchema), asyncHandler(EntityController.create));
router.get('/:id/provenance', asyncHandler(ProvenanceController.getEntityProvenance));
router.get('/:id', asyncHandler(EntityController.getById));
router.patch('/:id', validate(updateEntitySchema), asyncHandler(EntityController.update));

router.post('/link-case', validate(linkEntityToCaseSchema), asyncHandler(EntityController.linkToCase));
router.post('/mentions', validate(createEntityMentionSchema), asyncHandler(EntityController.createMention));

export const entityRoutes = router;
