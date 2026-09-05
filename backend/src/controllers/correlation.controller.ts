import { Request, Response } from 'express';
import { CorrelationEngineService } from '../services/correlationEngine.service';

export class CorrelationController {
  static async runCorrelation(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.body;
      const result = await CorrelationEngineService.runCorrelation(caseId);
      res.status(200).json({
        success: true,
        message: 'Cross-case correlation engine completed successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to run correlation engine' });
    }
  }

  static async getCorrelations(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : 0;
      const correlations = await CorrelationEngineService.getCorrelations(user.role, user.id, minScore);
      res.status(200).json({
        success: true,
        data: correlations,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch correlations' });
    }
  }

  static async getCorrelationById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const correlation = await CorrelationEngineService.getCorrelationById(id, user.role, user.id);
      if (!correlation) {
        res.status(404).json({ error: 'Correlation not found' });
        return;
      }
      res.status(200).json({
        success: true,
        data: correlation,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to correlation' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch correlation' });
    }
  }

  static async getCaseCorrelations(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const correlations = await CorrelationEngineService.getCaseCorrelations(id, user.role, user.id);
      res.status(200).json({
        success: true,
        data: correlations,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case correlations' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch case correlations' });
    }
  }
}
