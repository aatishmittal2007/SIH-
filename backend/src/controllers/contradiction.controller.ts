import { Request, Response } from 'express';
import { ContradictionDetectionService } from '../services/contradictionDetection.service';

export class ContradictionController {
  /**
   * POST /api/v1/contradictions/detect
   * Body: { caseId: string }
   */
  static async detectContradictions(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.body;
      const user = (req as any).user;

      if (!caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }

      const result = await ContradictionDetectionService.detectContradictions(
        caseId,
        user.role,
        user.userId
      );

      res.status(200).json(result);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case' });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to run contradiction detection' });
    }
  }

  /**
   * GET /api/v1/contradictions
   */
  static async getAllContradictions(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const contradictions = await ContradictionDetectionService.getAllContradictions(
        user.role,
        user.userId || user.id
      );

      res.status(200).json({ success: true, data: contradictions });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch contradictions' });
    }
  }

  /**
   * GET /api/v1/contradictions/case/:caseId
   */
  static async getContradictions(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const user = (req as any).user;

      const contradictions = await ContradictionDetectionService.getContradictions(
        caseId,
        user.role,
        user.userId
      );

      res.status(200).json(contradictions);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case' });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to fetch contradictions' });
    }
  }

  /**
   * GET /api/v1/contradictions/:id
   */
  static async getContradictionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const contradiction = await ContradictionDetectionService.getContradictionById(
        id,
        user.role,
        user.userId
      );

      if (!contradiction) {
        res.status(404).json({ error: 'Contradiction not found' });
        return;
      }

      res.status(200).json(contradiction);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to fetch contradiction' });
    }
  }

  /**
   * PATCH /api/v1/contradictions/:id/resolve
   * Body: { resolutionNotes?: string }
   */
  static async resolveContradiction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      const user = (req as any).user;

      const resolved = await ContradictionDetectionService.resolveContradiction(
        id,
        user.role,
        user.userId,
        resolutionNotes
      );

      res.status(200).json(resolved);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      if (err.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Contradiction not found' });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to resolve contradiction' });
    }
  }
}
