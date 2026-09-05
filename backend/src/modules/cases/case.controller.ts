import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CaseService } from './case.service';
import { createCaseSchema, updateCaseSchema, assignCaseSchema, getCasesQuerySchema } from './case.schema';

export class CaseController {
  static async getCases(req: AuthRequest, res: Response) {
    const queryParams = getCasesQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await CaseService.getCasesForUser(userId, role, queryParams);
    res.json(result);
  }

  static async createCase(req: AuthRequest, res: Response) {
    const input = createCaseSchema.parse(req.body);
    const userId = req.user!.id;

    const newCase = await CaseService.createCase(input, userId, req.ip);
    res.status(201).json(newCase);
  }

  static async getCaseById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const caseItem = await CaseService.getCaseById(id, userId, role, req.ip);
    res.json(caseItem);
  }

  static async updateCase(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const input = updateCaseSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;

    const updatedCase = await CaseService.updateCase(id, input, userId, role, req.ip);
    res.json(updatedCase);
  }

  static async archiveCase(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const archivedCase = await CaseService.archiveOrDeleteCase(id, userId, role, req.ip);
    res.json({ message: 'Case archived successfully', case: archivedCase });
  }

  static async assignUser(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { userId: targetUserId } = assignCaseSchema.parse(req.body);
    const assignedById = req.user!.id;
    const role = req.user!.role;

    const assignment = await CaseService.assignUserToCase(id, targetUserId, assignedById, role, req.ip);
    res.status(201).json(assignment);
  }

  static async getAssignments(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const assignments = await CaseService.getCaseAssignments(id, userId, role);
    res.json(assignments);
  }

  static async removeUserAssignment(req: AuthRequest, res: Response) {
    const { id, userId: targetUserId } = req.params;
    const removedById = req.user!.id;
    const role = req.user!.role;

    const result = await CaseService.removeUserFromCase(id, targetUserId, removedById, role, req.ip);
    res.json(result);
  }
}
