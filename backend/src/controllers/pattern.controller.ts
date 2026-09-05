import { Request, Response } from 'express';
import { PatternDetectionService } from '../services/patternDetection.service';

export class PatternController {
  static async runPatternDetection(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.body;
      const count = await PatternDetectionService.runPatternDetection(caseId);
      res.status(200).json({
        success: true,
        message: `Pattern detection completed. ${count} new pattern(s) identified and stored.`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to run pattern detection engine' });
    }
  }

  static async getPatterns(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : 0;
      const patterns = await PatternDetectionService.getPatterns(user.role, user.id, minScore);
      res.status(200).json({
        success: true,
        data: patterns,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch detected patterns' });
    }
  }

  static async getPatternById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const pattern = await PatternDetectionService.getPatternById(id, user.role, user.id);
      if (!pattern) {
        res.status(404).json({ error: 'Pattern not found' });
        return;
      }
      res.status(200).json({
        success: true,
        data: pattern,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to detected pattern' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch pattern' });
    }
  }
}
