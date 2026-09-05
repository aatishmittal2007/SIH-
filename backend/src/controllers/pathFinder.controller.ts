import { Request, Response } from 'express';
import { PathFinderService } from '../services/pathFinder.service';

export class PathFinderController {
  /**
   * POST /api/v1/intelligence/path-finder
   * Body: { sourceEntityId?: string, startEntityId?: string, targetEntityId: string, maxDepth?: number }
   */
  static async findPaths(req: Request, res: Response): Promise<void> {
    try {
      const { sourceEntityId, startEntityId, targetEntityId, maxDepth } = req.body;
      const user = (req as any).user;

      const fromId = sourceEntityId || startEntityId;

      if (!fromId || !targetEntityId) {
        res.status(400).json({ error: 'sourceEntityId (or startEntityId) and targetEntityId are required' });
        return;
      }

      const result = await PathFinderService.findPath(
        fromId,
        targetEntityId,
        maxDepth ? Number(maxDepth) : 5,
        user.role,
        user.id || user.userId
      );

      res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      if (err.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Source or target entity not found' });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to execute path finding' });
    }
  }
}
