import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { EntityResolutionService } from '../services/entityResolution.service';
import { MatchStatus, EntityType } from '@prisma/client';

export class EntityResolutionController {
  /**
   * GET /api/entity-resolution/candidates
   * Query candidate matches for review dashboard
   */
  static async getCandidates(req: AuthRequest, res: Response) {
    try {
      const { status, caseId, entityType, page, limit } = req.query;

      const result = await EntityResolutionService.getCandidates({
        status: status ? (status as MatchStatus) : MatchStatus.PENDING,
        caseId: caseId ? String(caseId) : undefined,
        entityType: entityType ? (entityType as EntityType) : undefined,
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 20,
      });

      return res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error: any) {
      console.error('[EntityResolutionController] getCandidates error:', error);
      return res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to fetch candidate matches' },
      });
    }
  }

  /**
   * GET /api/entity-resolution/candidates/:id
   * Get specific candidate match details
   */
  static async getCandidateById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const candidate = await EntityResolutionService.getCandidateById(id);

      return res.status(200).json({
        success: true,
        data: candidate,
      });
    } catch (error: any) {
      console.error('[EntityResolutionController] getCandidateById error:', error);
      return res.status(404).json({
        success: false,
        error: { message: error.message || 'Candidate match not found' },
      });
    }
  }

  /**
   * POST /api/entity-resolution/generate
   * Trigger candidate match generation pipeline
   */
  static async generateCandidates(req: AuthRequest, res: Response) {
    try {
      const { caseId, entityId, threshold } = req.body;

      const matches = await EntityResolutionService.generateAndSaveCandidates({
        caseId,
        entityId,
        threshold: threshold ? parseFloat(threshold) : 0.60,
      });

      return res.status(200).json({
        success: true,
        message: `Candidate generation complete. ${matches.length} matches surfaced.`,
        data: {
          generatedCount: matches.length,
          matches,
        },
      });
    } catch (error: any) {
      console.error('[EntityResolutionController] generateCandidates error:', error);
      return res.status(500).json({
        success: false,
        error: { message: error.message || 'Failed to generate match candidates' },
      });
    }
  }

  /**
   * POST /api/entity-resolution/candidates/:id/confirm
   * Investigator confirms entity match candidate
   */
  static async confirmCandidateMatch(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      }

      const match = await EntityResolutionService.confirmCandidateMatch(id, userId, comment);

      return res.status(200).json({
        success: true,
        message: 'Entity candidate match confirmed successfully.',
        data: match,
      });
    } catch (error: any) {
      console.error('[EntityResolutionController] confirmCandidateMatch error:', error);
      return res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to confirm candidate match' },
      });
    }
  }

  /**
   * POST /api/entity-resolution/candidates/:id/reject
   * Investigator rejects entity match candidate
   */
  static async rejectCandidateMatch(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      }

      const match = await EntityResolutionService.rejectCandidateMatch(id, userId, comment);

      return res.status(200).json({
        success: true,
        message: 'Entity candidate match rejected successfully.',
        data: match,
      });
    } catch (error: any) {
      console.error('[EntityResolutionController] rejectCandidateMatch error:', error);
      return res.status(400).json({
        success: false,
        error: { message: error.message || 'Failed to reject candidate match' },
      });
    }
  }
}
