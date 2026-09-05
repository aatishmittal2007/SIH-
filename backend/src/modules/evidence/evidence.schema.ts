import { z } from 'zod';
import { EvidenceType } from '@prisma/client';

export const createEvidenceSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  type: z.nativeEnum(EvidenceType),
  sourceId: z.string().min(1, 'Source ID is required'),
  description: z.string().optional(),
});

export const updateEvidenceSchema = z.object({
  title: z.string().min(2).optional(),
  type: z.nativeEnum(EvidenceType).optional(),
  sourceId: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const getEvidenceQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  caseId: z.string().optional(),
  type: z.nativeEnum(EvidenceType).optional(),
  search: z.string().optional(),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;
export type GetEvidenceQueryInput = z.infer<typeof getEvidenceQuerySchema>;
