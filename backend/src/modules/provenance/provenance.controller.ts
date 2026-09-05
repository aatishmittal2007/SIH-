import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ProvenanceService } from '../../services/provenance.service';

export class ProvenanceController {
  /**
   * GET /api/v1/entities/:id/provenance
   * GET /api/v1/provenance/entity/:id
   */
  static async getEntityProvenance(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userContext = {
      userId: req.user!.id,
      role: req.user!.role,
      ipAddress: req.ip,
    };

    const provenance = await ProvenanceService.getEntityProvenance(id, userContext);
    res.json(provenance);
  }

  /**
   * GET /api/v1/evidence/:id/provenance
   * GET /api/v1/provenance/evidence/:id
   */
  static async getEvidenceProvenance(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userContext = {
      userId: req.user!.id,
      role: req.user!.role,
      ipAddress: req.ip,
    };

    const provenance = await ProvenanceService.getEvidenceProvenance(id, userContext);
    res.json(provenance);
  }

  /**
   * GET /api/v1/cases/:id/provenance
   * GET /api/v1/provenance/case/:id
   */
  static async getCaseProvenance(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userContext = {
      userId: req.user!.id,
      role: req.user!.role,
      ipAddress: req.ip,
    };

    const provenance = await ProvenanceService.getCaseProvenance(id, userContext);
    res.json(provenance);
  }
}
