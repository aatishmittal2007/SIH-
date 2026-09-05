import { SourceType, SourceReliability } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { CreateSourceInput, UpdateSourceInput } from './source.schema';
import { Neo4jSyncService } from '../../services/neo4jSync.service';

export class SourceService {
  static async getAllSources() {
    return await prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { evidence: true, events: true } },
      },
    });
  }

  static async getSourceById(id: string) {
    const source = await prisma.source.findUnique({
      where: { id },
      include: {
        evidence: { take: 10, select: { id: true, title: true, type: true } },
        events: { take: 10, select: { id: true, description: true, type: true } },
        _count: { select: { evidence: true, events: true } },
      },
    });

    if (!source) {
      throw AppError.notFound('Source not found');
    }

    return source;
  }

  static async createSource(input: CreateSourceInput, userId: string, ipAddress?: string) {
    const source = await prisma.source.create({
      data: {
        name: input.name,
        type: input.type as SourceType,
        reliability: input.reliability as SourceReliability,
        description: input.description,
      },
    });

    // Synchronize to Neo4j
    await Neo4jSyncService.syncSource(source);

    await createAuditLog({
      userId,
      action: 'CREATE_SOURCE',
      resourceType: 'Source',
      resourceId: source.id,
      metadata: { name: source.name, type: source.type },
      ipAddress,
    });

    return source;
  }

  static async updateSource(id: string, input: UpdateSourceInput, userId: string, ipAddress?: string) {
    const existing = await prisma.source.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Source not found');
    }

    const updated = await prisma.source.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type as SourceType } : {}),
        ...(input.reliability ? { reliability: input.reliability as SourceReliability } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    });

    await Neo4jSyncService.syncSource(updated);

    await createAuditLog({
      userId,
      action: 'UPDATE_SOURCE',
      resourceType: 'Source',
      resourceId: id,
      metadata: { updatedFields: Object.keys(input) },
      ipAddress,
    });

    return updated;
  }
}
