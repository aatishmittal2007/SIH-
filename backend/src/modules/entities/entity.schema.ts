import { z } from 'zod';
import { EntityType } from '@prisma/client';

export const createEntitySchema = z.object({
  type: z.nativeEnum(EntityType),
  canonicalValue: z.string().min(1, 'Canonical value is required'),
  displayName: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateEntitySchema = z.object({
  displayName: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const linkEntityToCaseSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  entityId: z.string().min(1, 'Entity ID is required'),
  role: z.string().optional().default('SUSPECT'),
  confidence: z.number().min(0).max(1).optional().default(1.0),
});

export const createEntityMentionSchema = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  entityId: z.string().min(1, 'Entity ID is required'),
  originalText: z.string().min(1, 'Original text is required'),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  extractionMethod: z.string().optional().default('MANUAL'),
  contextSnippet: z.string().optional(),
});

export const getEntitiesQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  type: z.nativeEnum(EntityType).optional(),
  search: z.string().optional(),
  caseId: z.string().optional(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type LinkEntityToCaseInput = z.infer<typeof linkEntityToCaseSchema>;
export type CreateEntityMentionInput = z.infer<typeof createEntityMentionSchema>;
export type GetEntitiesQueryInput = z.infer<typeof getEntitiesQuerySchema>;
