import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { SourceService } from './source.service';
import { createSourceSchema, updateSourceSchema } from './source.schema';

export class SourceController {
  static async getAll(req: AuthRequest, res: Response) {
    const sources = await SourceService.getAllSources();
    res.json(sources);
  }

  static async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const source = await SourceService.getSourceById(id);
    res.json(source);
  }

  static async create(req: AuthRequest, res: Response) {
    const input = createSourceSchema.parse(req.body);
    const userId = req.user!.id;
    const source = await SourceService.createSource(input, userId, req.ip);
    res.status(201).json(source);
  }

  static async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const input = updateSourceSchema.parse(req.body);
    const userId = req.user!.id;
    const updated = await SourceService.updateSource(id, input, userId, req.ip);
    res.json(updated);
  }
}
