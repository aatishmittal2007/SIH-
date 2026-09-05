import { Router } from 'express';
import { GeospatialController } from '../controllers/geospatial.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/locations', authenticate, GeospatialController.getMapLocations);

export default router;
