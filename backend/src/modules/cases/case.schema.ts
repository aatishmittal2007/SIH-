import { z } from 'zod';
import { CaseStatus, CasePriority } from '@prisma/client';

export const createCaseSchema = z.object({
  caseNumber: z.string().min(3, 'Case number must be at least 3 characters'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional(),
  status: z.nativeEnum(CaseStatus).optional().default(CaseStatus.OPEN),
  priority: z.nativeEnum(CasePriority).optional().default(CasePriority.MEDIUM),
});

export const updateCaseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').optional(),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
});

export const assignCaseSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const getCasesQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'caseNumber', 'priority', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;
export type GetCasesQueryInput = z.infer<typeof getCasesQuerySchema>;
