import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { UserRole } from '@prisma/client';

export class DashboardController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const role: UserRole = user?.role || UserRole.INVESTIGATOR;

      const summary = await DashboardService.getDashboardSummary(userId, role);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}
