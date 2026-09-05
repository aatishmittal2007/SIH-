import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { validate } from '../../middleware/validate.middleware';
import { EventController } from './event.controller';
import { createEventSchema, updateEventSchema } from './event.schema';

const router = Router();

router.use(authenticate);

router.post('/', validate(createEventSchema), asyncHandler(EventController.create));
router.get('/', asyncHandler(EventController.list));
router.get('/:id', asyncHandler(EventController.getById));
router.patch('/:id', validate(updateEventSchema), asyncHandler(EventController.update));
router.delete('/:id', asyncHandler(EventController.delete));

export const eventRoutes = router;
