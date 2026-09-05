import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { EntityService } from './entity.service';
import {
  createEntitySchema,
  updateEntitySchema,
  linkEntityToCaseSchema,
  createEntityMentionSchema,
  getEntitiesQuerySchema,
} from './entity.schema';

export class EntityController {
  static async create(req: AuthRequest, res: Response) {
    const input = createEntitySchema.parse(req.body);
    const userId = req.user!.id;
    const entity = await EntityService.createOrGetEntity(input, userId, req.ip);
    res.status(201).json(entity);
  }

  static async list(req: AuthRequest, res: Response) {
    const queryParams = getEntitiesQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const role = req.user!.role;
    const result = await EntityService.listEntities(queryParams, userId, role);
    res.json(result);
  }

  static async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const entity = await EntityService.getEntityById(id);
    res.json(entity);
  }

  static async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const input = updateEntitySchema.parse(req.body);
    const userId = req.user!.id;
    const updated = await EntityService.updateEntity(id, input, userId, req.ip);
    res.json(updated);
  }

  static async linkToCase(req: AuthRequest, res: Response) {
    const input = linkEntityToCaseSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;
    const link = await EntityService.linkEntityToCase(input, userId, role, req.ip);
    res.status(201).json(link);
  }

  static async createMention(req: AuthRequest, res: Response) {
    const input = createEntityMentionSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;
    const mention = await EntityService.createEntityMention(input, userId, role, req.ip);
    res.status(201).json(mention);
  }
}
