import { z } from 'zod';
import { SourceType, SourceReliability } from '@prisma/client';

export const createSourceSchema = z.object({
  name: z.string().min(2, 'Source name must be at least 2 characters'),
  type: z.nativeEnum(SourceType),
  reliability: z.nativeEnum(SourceReliability).optional().default(SourceReliability.UNVERIFIED),
  description: z.string().optional(),
});

export const updateSourceSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.nativeEnum(SourceType).optional(),
  reliability: z.nativeEnum(SourceReliability).optional(),
  description: z.string().optional(),
});


export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
