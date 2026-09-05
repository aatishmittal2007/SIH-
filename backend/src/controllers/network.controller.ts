import { Request, Response } from 'express';
import { NetworkAnalysisService } from '../services/networkAnalysis.service';

export class NetworkController {
  static async getEntityCentrality(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const metrics = await NetworkAnalysisService.getEntityCentrality(id, user.role, user.id);
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to entity metrics' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch entity centrality' });
    }
  }

  static async getCaseNetwork(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const network = await NetworkAnalysisService.getCaseNetwork(id, user.role, user.id);
      res.status(200).json({
        success: true,
        data: network,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case network graph' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch case network graph' });
    }
  }

  static async findShortestPath(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { sourceId, targetId } = req.query;
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 4;

      if (!sourceId || !targetId) {
        res.status(400).json({ error: 'sourceId and targetId query parameters are required' });
        return;
      }

      const pathResult = await NetworkAnalysisService.findShortestPath(
        sourceId as string,
        targetId as string,
        maxDepth,
        user.role,
        user.id
      );

      if (!pathResult) {
        res.status(404).json({ message: 'No network path found between entities within depth limit' });
        return;
      }

      res.status(200).json({
        success: true,
        data: pathResult,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to network path query' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to calculate network path' });
    }
  }

  static async getInteractiveGraph(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { caseId, entityType, relationshipType, searchQuery, limit } = req.query;

      const graph = await NetworkAnalysisService.getInteractiveGraph(
        {
          caseId: caseId as string,
          entityType: entityType as string,
          relationshipType: relationshipType as string,
          searchQuery: searchQuery as string,
          limit: limit ? parseInt(limit as string) : 100,
        },
        user.role,
        user.id
      );

      res.status(200).json({
        success: true,
        data: graph,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to interactive graph' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch interactive graph' });
    }
  }

  static async expandNode(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const expanded = await NetworkAnalysisService.expandNode(nodeId, maxDepth, limit, user.role, user.id);

      res.status(200).json({
        success: true,
        data: expanded,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to expand node' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to expand node' });
    }
  }

  static async getNodeDetails(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const details = await NetworkAnalysisService.getNodeDetails(id, user.role, user.id);

      res.status(200).json({
        success: true,
        data: details,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to node details' });
        return;
      }
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Node not found' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch node details' });
    }
  }

  static async getRelationshipDetails(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { sourceId, targetId, type } = req.query;

      if (!sourceId || !targetId) {
        res.status(400).json({ error: 'sourceId and targetId query parameters are required' });
        return;
      }

      const relDetails = await NetworkAnalysisService.getRelationshipDetails(
        sourceId as string,
        targetId as string,
        type as string,
        user.role,
        user.id
      );

      res.status(200).json({
        success: true,
        data: relDetails,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to relationship details' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch relationship details' });
    }
  }
}
