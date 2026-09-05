import { UserRole, EventType, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { Neo4jSyncService } from '../../services/neo4jSync.service';
import { CaseService } from '../cases/case.service';
import { CreateEventInput, UpdateEventInput, GetEventsQueryInput } from './event.schema';

export class EventService {
  /**
   * Create an Event tied to a Case, Source, and optional Location Entity
   */
  static async createEvent(input: CreateEventInput, userId: string, role: UserRole, ipAddress?: string) {
    await CaseService.checkCaseAccess(input.caseId, userId, role);

    const source = await prisma.source.findUnique({ where: { id: input.sourceId } });
    if (!source) {
      throw AppError.notFound(`Source with ID '${input.sourceId}' not found`);
    }

    if (input.locationEntityId) {
      const locationEntity = await prisma.entity.findUnique({ where: { id: input.locationEntityId } });
      if (!locationEntity) {
        throw AppError.notFound(`Location entity with ID '${input.locationEntityId}' not found`);
      }
    }

    const event = await prisma.event.create({
      data: {
        caseId: input.caseId,
        sourceId: input.sourceId,
        type: input.type as EventType,
        description: input.description,
        timestamp: input.timestamp,
        locationEntityId: input.locationEntityId,
      },
      include: {
        source: { select: { id: true, name: true, type: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
        locationEntity: true,
      },
    });

    // Synchronize to Neo4j
    await Neo4jSyncService.syncEvent(event);

    await createAuditLog({
      userId,
      action: 'CREATE_EVENT',
      resourceType: 'Event',
      resourceId: event.id,
      metadata: { caseId: input.caseId, type: input.type, timestamp: input.timestamp.toISOString() },
      ipAddress,
    });

    return event;
  }

  /**
   * List Events with timeline sorting, date filters, case scoping, and pagination
   */
  static async listEvents(queryParams: GetEventsQueryInput, userId: string, role: UserRole) {
    const { page, limit, caseId, type, search, startDate, endDate } = queryParams;
    const skip = (page - 1) * limit;

    let caseWhereFilter: Prisma.EventWhereInput = {};
    if (caseId) {
      await CaseService.checkCaseAccess(caseId, userId, role);
      caseWhereFilter = { caseId };
    } else if (role !== UserRole.ADMIN) {
      caseWhereFilter = {
        case: {
          OR: [
            { createdById: userId },
            { assignments: { some: { userId } } },
          ],
        },
      };
    }

    const whereCondition: Prisma.EventWhereInput = {
      ...caseWhereFilter,
      ...(type ? { type: type as EventType } : {}),
      ...(search
        ? {
            description: { contains: search, mode: 'insensitive' },
          }
        : {}),
      ...(startDate || endDate
        ? {
            timestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [total, events] = await Promise.all([
      prisma.event.count({ where: whereCondition }),
      prisma.event.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { timestamp: 'asc' }, // Chronological timeline order
        include: {
          source: { select: { id: true, name: true, type: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          locationEntity: true,
        },
      }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single event by ID
   */
  static async getEventById(id: string, userId: string, role: UserRole) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        source: true,
        case: { select: { id: true, caseNumber: true, title: true } },
        locationEntity: true,
      },
    });

    if (!event) {
      throw AppError.notFound('Event not found');
    }

    await CaseService.checkCaseAccess(event.caseId, userId, role);

    return event;
  }

  /**
   * Update event details
   */
  static async updateEvent(id: string, input: UpdateEventInput, userId: string, role: UserRole, ipAddress?: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Event not found');
    }

    await CaseService.checkCaseAccess(existing.caseId, userId, role);

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(input.type ? { type: input.type as EventType } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.timestamp ? { timestamp: input.timestamp } : {}),
        ...(input.locationEntityId !== undefined ? { locationEntityId: input.locationEntityId } : {}),
      },
      include: {
        source: { select: { id: true, name: true } },
        case: { select: { id: true, caseNumber: true } },
        locationEntity: true,
      },
    });

    await Neo4jSyncService.syncEvent(updated);

    await createAuditLog({
      userId,
      action: 'UPDATE_EVENT',
      resourceType: 'Event',
      resourceId: id,
      metadata: { updatedFields: Object.keys(input) },
      ipAddress,
    });

    return updated;
  }

  /**
   * Delete event (ADMIN or Creator)
   */
  static async deleteEvent(id: string, userId: string, role: UserRole, ipAddress?: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Event not found');
    }

    await CaseService.checkCaseAccess(existing.caseId, userId, role);

    await prisma.event.delete({ where: { id } });

    await createAuditLog({
      userId,
      action: 'DELETE_EVENT',
      resourceType: 'Event',
      resourceId: id,
      metadata: { caseId: existing.caseId, description: existing.description },
      ipAddress,
    });

    return { success: true };
  }
}
