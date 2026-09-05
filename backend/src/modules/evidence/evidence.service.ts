import crypto from 'crypto';
import { UserRole, EvidenceType, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError } from '../../utils/errors';
import { createAuditLog } from '../../utils/audit';
import { StorageService } from '../../services/storage.service';
import { Neo4jSyncService } from '../../services/neo4jSync.service';
import { CreateEvidenceInput, UpdateEvidenceInput, GetEvidenceQueryInput } from './evidence.schema';
import { CaseService } from '../cases/case.service';

export class EvidenceService {
  /**
   * Upload and register new evidence file
   */
  static async uploadEvidence(
    input: CreateEvidenceInput,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    role: UserRole,
    ipAddress?: string
  ) {
    // 1. Verify case access
    await CaseService.checkCaseAccess(input.caseId, userId, role);

    // 2. Verify Source existence
    const sourceExists = await prisma.source.findUnique({ where: { id: input.sourceId } });
    if (!sourceExists) {
      throw AppError.notFound(`Source with ID '${input.sourceId}' not found`);
    }

    // 3. Save file via StorageService (computes SHA-256 and stores securely)
    const evidenceId = crypto.randomUUID();
    const saveResult = StorageService.saveFile(
      input.caseId,
      evidenceId,
      originalName,
      fileBuffer,
      mimeType
    );

    // 4. Create Evidence in PostgreSQL
    const evidence = await prisma.evidence.create({
      data: {
        id: evidenceId,
        caseId: input.caseId,
        title: input.title,
        description: input.description,
        type: input.type as EvidenceType,
        sourceId: input.sourceId,
        fileName: saveResult.fileName,
        storagePath: saveResult.storagePath,
        mimeType: saveResult.mimeType,
        hash: saveResult.hash,
      },
      include: {
        source: { select: { id: true, name: true, type: true, reliability: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    });

    // 5. Synchronize to Neo4j
    await Neo4jSyncService.syncEvidence(evidence);

    // 6. Audit Logging
    await createAuditLog({
      userId,
      action: 'UPLOAD_EVIDENCE',
      resourceType: 'Evidence',
      resourceId: evidence.id,
      metadata: {
        caseId: input.caseId,
        hash: saveResult.hash,
        fileName: saveResult.fileName,
        fileSize: saveResult.sizeBytes,
        mimeType: saveResult.mimeType,
      },
      ipAddress,
    });

    return evidence;
  }

  /**
   * List evidence records with pagination, case filtering, search
   */
  static async listEvidence(queryParams: GetEvidenceQueryInput, userId: string, role: UserRole) {
    const { page, limit, caseId, type, search } = queryParams;
    const skip = (page - 1) * limit;

    // Filter by case access if caseId provided or filter accessible cases
    let caseIdFilter: Prisma.EvidenceWhereInput = {};
    if (caseId) {
      await CaseService.checkCaseAccess(caseId, userId, role);
      caseIdFilter = { caseId };
    } else if (role !== UserRole.ADMIN) {
      caseIdFilter = {
        case: {
          OR: [
            { createdById: userId },
            { assignments: { some: { userId } } },
          ],
        },
      };
    }

    const whereCondition: Prisma.EvidenceWhereInput = {
      ...caseIdFilter,
      ...(type ? { type: type as EvidenceType } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { fileName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, evidenceList] = await Promise.all([
      prisma.evidence.count({ where: whereCondition }),
      prisma.evidence.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          source: { select: { id: true, name: true, type: true } },
          case: { select: { id: true, caseNumber: true, title: true } },
          _count: { select: { entityMentions: true } },
        },
      }),
    ]);

    return {
      evidence: evidenceList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single evidence record details
   */
  static async getEvidenceById(id: string, userId: string, role: UserRole) {
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        source: true,
        case: { select: { id: true, caseNumber: true, title: true } },
        entityMentions: {
          include: { entity: true },
        },
      },
    });

    if (!evidence) {
      throw AppError.notFound('Evidence not found');
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    return evidence;
  }

  /**
   * Download / Stream evidence file with audit log & SHA-256 validation
   */
  static async getEvidenceFileForDownload(id: string, userId: string, role: UserRole, ipAddress?: string) {
    const evidence = await prisma.evidence.findUnique({ where: { id } });
    if (!evidence) {
      throw AppError.notFound('Evidence record not found');
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    // Verify file integrity before serving
    const isIntegrityValid = await StorageService.verifyFileIntegrity(evidence.storagePath, evidence.hash);
    if (!isIntegrityValid) {
      console.warn(`[SECURITY ALERT] Evidence file integrity mismatch for ID: ${id}`);
    }

    const stream = StorageService.getFileStream(evidence.storagePath);

    await createAuditLog({
      userId,
      action: 'DOWNLOAD_EVIDENCE',
      resourceType: 'Evidence',
      resourceId: evidence.id,
      metadata: {
        fileName: evidence.fileName,
        hash: evidence.hash,
        integrityValid: isIntegrityValid,
      },
      ipAddress,
    });

    return {
      stream,
      evidence,
      integrityValid: isIntegrityValid,
    };
  }

  /**
   * Update evidence metadata
   */
  static async updateEvidence(id: string, input: UpdateEvidenceInput, userId: string, role: UserRole, ipAddress?: string) {
    const existing = await prisma.evidence.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Evidence not found');
    }

    await CaseService.checkCaseAccess(existing.caseId, userId, role);

    const updated = await prisma.evidence.update({
      where: { id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.type ? { type: input.type as EvidenceType } : {}),
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
      include: {
        source: true,
      },
    });

    await Neo4jSyncService.syncEvidence(updated);

    await createAuditLog({
      userId,
      action: 'UPDATE_EVIDENCE',
      resourceType: 'Evidence',
      resourceId: id,
      metadata: { updatedFields: Object.keys(input) },
      ipAddress,
    });

    return updated;
  }

  /**
   * Delete evidence (ADMIN only)
   */
  static async deleteEvidence(id: string, userId: string, role: UserRole, ipAddress?: string) {
    if (role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only ADMIN can delete evidence records');
    }

    const existing = await prisma.evidence.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Evidence not found');
    }

    // Delete physical file from storage safely
    StorageService.deleteFile(existing.storagePath);

    // Delete DB record (cascades mentions)
    await prisma.evidence.delete({ where: { id } });

    await createAuditLog({
      userId,
      action: 'DELETE_EVIDENCE',
      resourceType: 'Evidence',
      resourceId: id,
      metadata: { title: existing.title, fileName: existing.fileName },
      ipAddress,
    });

    return { success: true };
  }
}
