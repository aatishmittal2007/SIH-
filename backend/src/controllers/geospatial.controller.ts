import { Request, Response } from 'express';
import { GeospatialService } from '../services/geospatial.service';

export class GeospatialController {
  static async getMapLocations(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { caseId, entityId, eventType, startDate, endDate, minConfidence, minLat, maxLat, minLng, maxLng, limit } = req.query;

      const result = await GeospatialService.getMapLocations(
        {
          caseId: caseId as string,
          entityId: entityId as string,
          eventType: eventType as string,
          startDate: startDate as string,
          endDate: endDate as string,
          minConfidence: minConfidence ? Number(minConfidence) : undefined,
          minLat: minLat ? Number(minLat) : undefined,
          maxLat: maxLat ? Number(maxLat) : undefined,
          minLng: minLng ? Number(minLng) : undefined,
          maxLng: maxLng ? Number(maxLng) : undefined,
          limit: limit ? Number(limit) : 200,
        },
        user.role,
        user.id
      );

      res.status(200).json({
        success: true,
        data: result.locations,
        total: result.total,
      });
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Access denied to location data' });
        return;
      }
      res.status(500).json({ error: error.message || 'Failed to fetch map locations' });
    }
  }
}
