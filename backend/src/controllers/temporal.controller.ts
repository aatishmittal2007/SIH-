import { Request, Response } from 'express';
import { TemporalAnalysisService } from '../services/temporalAnalysis.service';

export class TemporalController {
  static async getCaseTimeline(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const timeline = await TemporalAnalysisService.getCaseTimeline(id, user.role, user.id);
      res.status(200).json({
        success: true,
        data: timeline,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case timeline' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch case timeline' });
    }
  }

  static async getCaseTemporalAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const analysis = await TemporalAnalysisService.analyzeCaseTemporalPatterns(id, user.role, user.id);
      res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to temporal analysis' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to analyze temporal patterns' });
    }
  }

  static async getTimelineEvents(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { caseId, entityId, eventType, startDate, endDate, minConfidence, order, page, limit } = req.query;

      const result = await TemporalAnalysisService.getFilteredTimeline(
        {
          caseId: caseId as string,
          entityId: entityId as string,
          eventType: eventType as string,
          startDate: startDate as string,
          endDate: endDate as string,
          minConfidence: minConfidence ? Number(minConfidence) : undefined,
          order: order as 'asc' | 'desc',
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 50,
        },
        user.role,
        user.id
      );

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to timeline data' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch timeline events' });
    }
  }
}
