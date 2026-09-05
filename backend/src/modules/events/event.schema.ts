import { z } from 'zod';
import { EventType } from '@prisma/client';

export const createEventSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  sourceId: z.string().min(1, 'Source ID is required'),
  type: z.nativeEnum(EventType).optional().default(EventType.INCIDENT),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  timestamp: z.string().transform((val) => new Date(val)),
  locationEntityId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateEventSchema = z.object({
  type: z.nativeEnum(EventType).optional(),
  description: z.string().min(3).optional(),
  timestamp: z.string().transform((val) => new Date(val)).optional(),
  locationEntityId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const getEventsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  caseId: z.string().optional(),
  type: z.nativeEnum(EventType).optional(),
  search: z.string().optional(),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type GetEventsQueryInput = z.infer<typeof getEventsQuerySchema>;
