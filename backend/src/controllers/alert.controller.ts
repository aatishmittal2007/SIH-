import { Request, Response, NextFunction } from 'express';
import { AlertService } from '../services/alert.service';
import { UserRole, AlertStatus, SeverityLevel, AlertType } from '@prisma/client';

export class AlertController {
  static async listAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { caseId, severity, status, type, entityId, limit, offset } = req.query;

      const result = await AlertService.listAlerts(
        {
          caseId: caseId as string,
          severity: severity as SeverityLevel,
          status: status as AlertStatus,
          type: type as AlertType,
          entityId: entityId as string,
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
        },
        userId,
        role
      );

      res.json(result);
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case alerts' });
        return;
      }
      next(error);
    }
  }

  static async generateAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { caseId } = req.body;

      const generated = await AlertService.generateAlertsFromSignals(caseId);
      res.json({ message: 'Alert generation complete', createdCount: generated.createdCount });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to case' });
        return;
      }
      next(error);
    }
  }

  static async getAlertById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { id } = req.params;
      const alert = await AlertService.getAlertById(id, userId, role);

      res.json(alert);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      next(error);
    }
  }

  static async updateAlertStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const { id } = req.params;
      const { status, resolutionReason, comment } = req.body;

      if (!status) {
        res.status(400).json({ error: 'status is required' });
        return;
      }

      const updated = await AlertService.updateAlertStatus(
        id,
        status as AlertStatus,
        comment || resolutionReason,
        userId,
        role
      );

      res.json(updated);
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Alert not found' });
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
