import { Request, Response } from 'express';
import { RelationshipBuilderService } from '../services/relationshipBuilder.service';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export class RelationshipController {
  static async rebuildRelationships(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { caseId } = req.body;

      if (caseId && user.role !== UserRole.ADMIN) {
        const assignment = await prisma.caseAssignment.findUnique({
          where: { caseId_userId: { caseId, userId: user.id } },
        });
        if (!assignment) {
          res.status(403).json({ error: 'Access denied to target case' });
          return;
        }
      }

      const result = await RelationshipBuilderService.buildRelationshipsForCase(caseId);
      res.status(200).json({
        success: true,
        message: 'Relationships successfully processed and built in Neo4j',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to rebuild relationships' });
    }
  }

  static async getEntityRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const relationships = await RelationshipBuilderService.getRelationshipsForEntity(id);
      res.status(200).json({
        success: true,
        data: relationships,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch entity relationships' });
    }
  }
}
