import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { UserRole } from '@prisma/client';

export class ReportController {
  static async generateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { caseId, format } = req.body;
      if (!caseId) {
        res.status(400).json({ error: 'caseId is required' });
        return;
      }

      const report = await ReportService.generateCaseReport(
        caseId,
        userId,
        role,
        format || 'JSON'
      );

      res.status(201).json(report);
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case' });
        return;
      }
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Case not found' });
        return;
      }
      next(error);
    }
  }

  static async listReports(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { caseId, limit, offset } = req.query;

      const result = await ReportService.listReports(
        {
          caseId: caseId as string,
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
        },
        userId,
        role
      );

      res.json(result);
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case reports' });
        return;
      }
      next(error);
    }
  }

  static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { id } = req.params;
      const report = await ReportService.getReport(id, userId, role);

      res.json(report);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      next(error);
    }
  }

  static async downloadReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { id } = req.params;
      const downloadData = await ReportService.downloadReport(id, userId, role);

      res.setHeader('Content-Type', downloadData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadData.fileName}"`);
      res.send(downloadData.data);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      next(error);
    }
  }
}
