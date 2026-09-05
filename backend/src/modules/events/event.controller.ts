import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { EventService } from './event.service';
import { createEventSchema, updateEventSchema, getEventsQuerySchema } from './event.schema';

export class EventController {
  static async create(req: AuthRequest, res: Response) {
    const input = createEventSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;

    const event = await EventService.createEvent(input, userId, role, req.ip);
    res.status(201).json(event);
  }

  static async list(req: AuthRequest, res: Response) {
    const queryParams = getEventsQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await EventService.listEvents(queryParams, userId, role);
    res.json(result);
  }

  static async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const event = await EventService.getEventById(id, userId, role);
    res.json(event);
  }

  static async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const input = updateEventSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;

    const updated = await EventService.updateEvent(id, input, userId, role, req.ip);
    res.json(updated);
  }

  static async delete(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await EventService.deleteEvent(id, userId, role, req.ip);
    res.json(result);
  }
}
