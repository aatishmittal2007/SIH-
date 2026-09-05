import { UserRole, CaseStatus, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { CreateCaseInput, UpdateCaseInput, GetCasesQueryInput } from './case.schema';
import { Neo4jSyncService } from '../../services/neo4jSync.service';

export class CaseService {
  /**
   * Check if a user has permission to access a given case
   */
  static async checkCaseAccess(caseId: string, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return true;
    }

    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        createdById: true,
        assignments: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!caseItem) {
      throw AppError.notFound('Case not found');
    }

    const isCreator = caseItem.createdById === userId;
    const isAssigned = caseItem.assignments.length > 0;

    if (!isCreator && !isAssigned) {
      throw AppError.forbidden('Access denied: You are not assigned to this case');
    }

    return true;
  }

  /**
   * Get all cases accessible by user with pagination, search, and filters
   */
  static async getCasesForUser(userId: string, role: UserRole, queryParams: GetCasesQueryInput) {
    const { page, limit, search, status, priority, sortBy, sortOrder } = queryParams;
    const skip = (page - 1) * limit;

    // Build base filter based on RBAC scoping
    const accessFilter: Prisma.CaseWhereInput =
      role === UserRole.ADMIN
        ? {}
        : {
            OR: [
              { createdById: userId },
              { assignments: { some: { userId } } },
            ],
          };

    // Combine with search and filters
    const whereCondition: Prisma.CaseWhereInput = {
      ...accessFilter,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(search
        ? {
            OR: [
              { caseNumber: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, cases] = await Promise.all([
      prisma.case.count({ where: whereCondition }),
      prisma.case.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, role: true } },
            },
          },
          _count: {
            select: { evidence: true, caseEntities: true, events: true, contradictions: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      cases,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Create a new case
   */
  static async createCase(input: CreateCaseInput, userId: string, ipAddress?: string) {
    const existingCase = await prisma.case.findUnique({
      where: { caseNumber: input.caseNumber },
    });

    if (existingCase) {
      throw AppError.conflict(`Case number '${input.caseNumber}' already exists`);
    }

    const newCase = await prisma.case.create({
      data: {
        caseNumber: input.caseNumber,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        createdById: userId,
        assignments: {
          create: {
            userId: userId,
            assignedById: userId,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignments: true,
      },
    });

    // Synchronize Case node to Neo4j
    await Neo4jSyncService.syncCase(newCase);

    await createAuditLog({
      userId,
      action: 'CREATE_CASE',
      resourceType: 'Case',
      resourceId: newCase.id,
      metadata: { caseNumber: newCase.caseNumber, title: newCase.title },
      ipAddress,
    });

    return newCase;
  }

  /**
   * Get single case by ID with access control & audit log
   */
  static async getCaseById(caseId: string, userId: string, role: UserRole, ipAddress?: string) {
    await this.checkCaseAccess(caseId, userId, role);

    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
        evidence: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { source: { select: { id: true, name: true, type: true } } },
        },
        caseEntities: {
          take: 20,
          include: { entity: true },
        },
        events: {
          take: 20,
          orderBy: { timestamp: 'asc' },
          include: { source: { select: { id: true, name: true } } },
        },
        alerts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        contradictions: {
          take: 10,
        },
        _count: {
          select: { evidence: true, caseEntities: true, events: true, contradictions: true, alerts: true },
        },
      },
    });

    if (!caseItem) {
      throw AppError.notFound('Case not found');
    }

    await createAuditLog({
      userId,
      action: 'VIEW_CASE',
      resourceType: 'Case',
      resourceId: caseItem.id,
      metadata: { caseNumber: caseItem.caseNumber },
      ipAddress,
    });

    return caseItem;
  }

  /**
   * Update case details
   */
  static async updateCase(caseId: string, input: UpdateCaseInput, userId: string, role: UserRole, ipAddress?: string) {
    await this.checkCaseAccess(caseId, userId, role);

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) {
      throw AppError.notFound('Case not found');
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    // Synchronize updated Case node to Neo4j
    await Neo4jSyncService.syncCase(updatedCase);

    await createAuditLog({
      userId,
      action: 'UPDATE_CASE',
      resourceType: 'Case',
      resourceId: caseId,
      metadata: { updatedFields: Object.keys(input) },
      ipAddress,
    });

    return updatedCase;
  }

  /**
   * Delete / Archive Case (ADMIN only for hard delete, soft archive for status)
   */
  static async archiveOrDeleteCase(caseId: string, userId: string, role: UserRole, ipAddress?: string) {
    if (role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only ADMIN can perform case archiving or deletion');
    }

    const existing = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existing) {
      throw AppError.notFound('Case not found');
    }

    // Soft delete / archive by updating status to ARCHIVED
    const archivedCase = await prisma.case.update({
      where: { id: caseId },
      data: { status: CaseStatus.ARCHIVED },
    });

    // Sync updated status to Neo4j
    await Neo4jSyncService.syncCase(archivedCase);

    await createAuditLog({
      userId,
      action: 'ARCHIVE_CASE',
      resourceType: 'Case',
      resourceId: caseId,
      metadata: { caseNumber: existing.caseNumber },
      ipAddress,
    });

    return archivedCase;
  }

  /**
   * Assign a user to a case
   */
  static async assignUserToCase(caseId: string, targetUserId: string, assignedById: string, role: UserRole, ipAddress?: string) {
    if (role !== UserRole.ADMIN) {
      // Investigators can only assign if they are the creator or assigned
      await this.checkCaseAccess(caseId, assignedById, role);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw AppError.notFound('Target user to assign does not exist');
    }

    const assignment = await prisma.caseAssignment.upsert({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
      update: {
        assignedById,
      },
      create: {
        caseId,
        userId: targetUserId,
        assignedById,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await createAuditLog({
      userId: assignedById,
      action: 'ASSIGN_CASE',
      resourceType: 'Case',
      resourceId: caseId,
      metadata: { assignedUserId: targetUserId, targetUserEmail: targetUser.email },
      ipAddress,
    });

    return assignment;
  }

  /**
   * Get assignments for a case
   */
  static async getCaseAssignments(caseId: string, userId: string, role: UserRole) {
    await this.checkCaseAccess(caseId, userId, role);

    return await prisma.caseAssignment.findMany({
      where: { caseId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  /**
   * Remove user assignment from a case
   */
  static async removeUserFromCase(caseId: string, targetUserId: string, removedById: string, role: UserRole, ipAddress?: string) {
    if (role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only ADMIN can unassign users from cases');
    }

    const assignment = await prisma.caseAssignment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
    });

    if (!assignment) {
      throw AppError.notFound('User is not assigned to this case');
    }

    await prisma.caseAssignment.delete({
      where: {
        caseId_userId: {
          caseId,
          userId: targetUserId,
        },
      },
    });

    await createAuditLog({
      userId: removedById,
      action: 'UNASSIGN_CASE',
      resourceType: 'Case',
      resourceId: caseId,
      metadata: { unassignedUserId: targetUserId },
      ipAddress,
    });

    return { success: true };
  }
}
