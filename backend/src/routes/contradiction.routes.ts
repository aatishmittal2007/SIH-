import { Router } from 'express';
import { ContradictionController } from '../controllers/contradiction.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', ContradictionController.getAllContradictions);
router.post('/detect', ContradictionController.detectContradictions);
router.get('/case/:caseId', ContradictionController.getContradictions);
router.get('/:id', ContradictionController.getContradictionById);
router.patch('/:id/resolve', ContradictionController.resolveContradiction);

export default router;
