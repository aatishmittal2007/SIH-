import { Router } from 'express';
import { NetworkController } from '../controllers/network.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/entities/:id/centrality', authenticate, NetworkController.getEntityCentrality);
router.get('/cases/:id/network', authenticate, NetworkController.getCaseNetwork);
router.get('/paths', authenticate, NetworkController.findShortestPath);
router.get('/interactive', authenticate, NetworkController.getInteractiveGraph);
router.get('/nodes/:nodeId/expand', authenticate, NetworkController.expandNode);
router.get('/nodes/:id', authenticate, NetworkController.getNodeDetails);
router.get('/relationships', authenticate, NetworkController.getRelationshipDetails);

export default router;
