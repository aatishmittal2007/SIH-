import { UserRole, CaseEntityRole, ProcessingStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { createAuditLog } from '../utils/audit';
import { StorageService } from './storage.service';
import { DocumentExtractorFactory } from './extractors/textExtractors';
import { TextNormalizationService } from './textNormalization.service';
import { TextChunkingService } from './textChunking.service';
import { NlpService, ExtractedEntityResult } from './nlp.service';
import { Neo4jSyncService } from './neo4jSync.service';
import { CaseService } from '../modules/cases/case.service';

export interface IngestionResult {
  evidenceId: string;
  caseId: string;
  fileName: string;
  processingStatus: ProcessingStatus;
  hash: string;
  documentMetrics: {
    pageCount: number;
    wordCount: number;
    characterCount: number;
    chunkCount: number;
    mimeType: string;
  };
  extractionSummary: {
    totalEntitiesFound: number;
    newEntitiesCreated: number;
    mentionsCreated: number;
  };
  mentions: Array<{
    id: string;
    entityId: string;
    entityName: string;
    entityType: string;
    normalizedValue: string;
    originalText: string;
    extractionConfidence: number;
    extractionMethod: string;
    chunkId?: string | null;
    startOffset?: number | null;
    endOffset?: number | null;
    context?: string | null;
  }>;
}

export class IngestionService {
  /**
   * Process uploaded evidence file end-to-end:
   * Validation -> SHA256 Hash -> Text Extraction -> Normalization -> Chunking -> NER -> Entity Deduplication -> Mentions -> Case-Entity -> Neo4j Sync -> Audit
   */
  static async processEvidence(
    evidenceId: string,
    userId: string,
    role: UserRole,
    ipAddress?: string
  ): Promise<IngestionResult> {
    // 1. Fetch Evidence & check authorization
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { source: true, case: true },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    // Update status to PROCESSING
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        processingStatus: ProcessingStatus.PROCESSING,
        processingStartedAt: new Date(),
        processingError: null,
      },
    });

    await createAuditLog({
      userId,
      action: 'EVIDENCE_PROCESS_STARTED',
      resourceType: 'Evidence',
      resourceId: evidence.id,
      metadata: { caseId: evidence.caseId, fileName: evidence.fileName },
      ipAddress,
    });

    try {
      // 2. Read physical file & compute SHA-256 hash
      const fileBuffer = StorageService.getFileBuffer(evidence.storagePath);
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error(`Evidence file '${evidence.fileName}' is empty or unreadable at ${evidence.storagePath}`);
      }

      const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (!evidence.hash || evidence.hash !== calculatedHash) {
        await prisma.evidence.update({
          where: { id: evidenceId },
          data: { hash: calculatedHash },
        });
      }

      // 3. Text Extraction
      const extractionResult = await DocumentExtractorFactory.extract(
        fileBuffer,
        evidence.fileName,
        evidence.mimeType
      );

      if (
        extractionResult.status === ProcessingStatus.OCR_REQUIRED ||
        extractionResult.status === ProcessingStatus.UNSUPPORTED ||
        extractionResult.status === ProcessingStatus.FAILED
      ) {
        await prisma.evidence.update({
          where: { id: evidenceId },
          data: {
            processingStatus: extractionResult.status,
            processingCompletedAt: new Date(),
            textExtractionStatus: extractionResult.status,
            processingError: extractionResult.error || `Extraction returned ${extractionResult.status}`,
          },
        });

        await createAuditLog({
          userId,
          action: 'EVIDENCE_PROCESS_FAILED',
          resourceType: 'Evidence',
          resourceId: evidence.id,
          metadata: { status: extractionResult.status, error: extractionResult.error },
          ipAddress,
        });

        return {
          evidenceId: evidence.id,
          caseId: evidence.caseId,
          fileName: evidence.fileName,
          processingStatus: extractionResult.status,
          hash: calculatedHash,
          documentMetrics: {
            pageCount: extractionResult.pageCount,
            wordCount: extractionResult.wordCount,
            characterCount: extractionResult.characterCount,
            chunkCount: 0,
            mimeType: evidence.mimeType,
          },
          extractionSummary: { totalEntitiesFound: 0, newEntitiesCreated: 0, mentionsCreated: 0 },
          mentions: [],
        };
      }

      // 4. Text Normalization
      const originalText = extractionResult.text;
      const normalizedText = TextNormalizationService.normalizeDocumentText(originalText);

      // Create / Update EvidenceDocument
      const document = await prisma.evidenceDocument.upsert({
        where: { evidenceId: evidence.id },
        create: {
          evidenceId: evidence.id,
          originalText,
          normalizedText,
          pageCount: extractionResult.pageCount,
          characterCount: normalizedText.length,
          wordCount: extractionResult.wordCount,
          extractionMethod: extractionResult.extractionMethod,
        },
        update: {
          originalText,
          normalizedText,
          pageCount: extractionResult.pageCount,
          characterCount: normalizedText.length,
          wordCount: extractionResult.wordCount,
          extractionMethod: extractionResult.extractionMethod,
        },
      });

      await createAuditLog({
        userId,
        action: 'TEXT_EXTRACTED',
        resourceType: 'Evidence',
        resourceId: evidence.id,
        metadata: { characterCount: normalizedText.length, wordCount: extractionResult.wordCount },
        ipAddress,
      });

      // 5. Text Chunking
      const generatedChunks = TextChunkingService.chunkText(normalizedText, 1000, 100);

      // Delete stale chunks on reprocessing
      await prisma.evidenceChunk.deleteMany({ where: { evidenceId: evidence.id } });

      const createdChunks = [];
      for (const chunk of generatedChunks) {
        const dbChunk = await prisma.evidenceChunk.create({
          data: {
            documentId: document.id,
            evidenceId: evidence.id,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            pageNumber: chunk.pageNumber,
          },
        });
        createdChunks.push(dbChunk);
      }

      // 6. NER / Entity Mention Detection
      const extractedEntities: ExtractedEntityResult[] = await NlpService.extractEntities(normalizedText);

      let newEntitiesCreated = 0;
      let mentionsCreated = 0;
      const createdMentionsSummary: IngestionResult['mentions'] = [];

      // 7. Entity Deduplication, Persistence & Neo4j Synchronization
      for (const extracted of extractedEntities) {
        const canonicalValue = extracted.text.trim();
        if (!canonicalValue) continue;

        const normalizedVal = extracted.normalizedValue || TextNormalizationService.normalizeEntityValue(canonicalValue, extracted.type);

        // Find existing Entity by exact normalizedValue & type match
        let entity = await prisma.entity.findFirst({
          where: {
            normalizedValue: normalizedVal,
            type: extracted.type,
          },
        });

        if (!entity) {
          entity = await prisma.entity.create({
            data: {
              canonicalValue,
              displayName: canonicalValue,
              normalizedValue: normalizedVal,
              type: extracted.type,
            },
          });
          newEntitiesCreated++;

          // Sync Entity to Neo4j
          await Neo4jSyncService.syncEntity({
            id: entity.id,
            type: entity.type,
            canonicalValue: entity.canonicalValue,
            displayName: entity.displayName,
            normalizedValue: entity.normalizedValue,
          });
        }

        // Identify associated chunk for provenance
        const matchedChunk = createdChunks.find(
          (c) => extracted.startOffset >= c.startOffset && extracted.endOffset <= c.endOffset + 50
        );

        // Check deduplication of EntityMention
        const existingMention = await prisma.entityMention.findFirst({
          where: {
            evidenceId: evidence.id,
            entityId: entity.id,
            startOffset: extracted.startOffset,
          },
        });

        let mentionRecord = existingMention;
        if (!mentionRecord) {
          mentionRecord = await prisma.entityMention.create({
            data: {
              evidenceId: evidence.id,
              entityId: entity.id,
              caseId: evidence.caseId,
              chunkId: matchedChunk?.id,
              originalText: extracted.text,
              extractionConfidence: extracted.confidence,
              extractionMethod: extracted.extractionMethod,
              context: extracted.context,
              startOffset: extracted.startOffset,
              endOffset: extracted.endOffset,
            },
            include: { entity: true },
          });

          mentionsCreated++;

          // Sync Entity Mention to Neo4j
          await Neo4jSyncService.syncEntityMention(
            evidence.id,
            entity.id,
            mentionRecord.originalText,
            mentionRecord.extractionMethod
          );
        }

        createdMentionsSummary.push({
          id: mentionRecord.id,
          entityId: entity.id,
          entityName: entity.displayName,
          entityType: entity.type,
          normalizedValue: entity.normalizedValue,
          originalText: mentionRecord.originalText,
          extractionConfidence: mentionRecord.extractionConfidence,
          extractionMethod: mentionRecord.extractionMethod,
          chunkId: mentionRecord.chunkId,
          startOffset: mentionRecord.startOffset,
          endOffset: mentionRecord.endOffset,
          context: mentionRecord.context,
        });

        // Ensure CaseEntity association (neutral role OTHER)
        const existingCaseLink = await prisma.caseEntity.findUnique({
          where: {
            caseId_entityId_role: {
              caseId: evidence.caseId,
              entityId: entity.id,
              role: CaseEntityRole.OTHER,
            },
          },
        });

        if (!existingCaseLink) {
          const caseEntity = await prisma.caseEntity.create({
            data: {
              caseId: evidence.caseId,
              entityId: entity.id,
              role: CaseEntityRole.OTHER,
              confidence: extracted.confidence,
            },
          });

          // Sync Case-Entity link to Neo4j
          await Neo4jSyncService.syncCaseEntity(
            caseEntity.caseId,
            caseEntity.entityId,
            caseEntity.role,
            caseEntity.confidence
          );
        }
      }

      // Mark evidence as COMPLETED
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          processingStatus: ProcessingStatus.COMPLETED,
          processingCompletedAt: new Date(),
          textExtractionStatus: 'COMPLETED',
          nlpStatus: 'COMPLETED',
          processingError: null,
        },
      });

      await createAuditLog({
        userId,
        action: 'EVIDENCE_PROCESS_COMPLETED',
        resourceType: 'Evidence',
        resourceId: evidence.id,
        metadata: {
          caseId: evidence.caseId,
          entitiesFound: extractedEntities.length,
          newEntitiesCreated,
          mentionsCreated,
        },
        ipAddress,
      });

      return {
        evidenceId: evidence.id,
        caseId: evidence.caseId,
        fileName: evidence.fileName,
        processingStatus: ProcessingStatus.COMPLETED,
        hash: calculatedHash,
        documentMetrics: {
          pageCount: extractionResult.pageCount,
          wordCount: extractionResult.wordCount,
          characterCount: normalizedText.length,
          chunkCount: createdChunks.length,
          mimeType: evidence.mimeType,
        },
        extractionSummary: {
          totalEntitiesFound: extractedEntities.length,
          newEntitiesCreated,
          mentionsCreated,
        },
        mentions: createdMentionsSummary,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown processing error';

      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          processingStatus: ProcessingStatus.FAILED,
          processingCompletedAt: new Date(),
          processingError: errorMessage,
        },
      });

      await createAuditLog({
        userId,
        action: 'EVIDENCE_PROCESS_FAILED',
        resourceType: 'Evidence',
        resourceId: evidence.id,
        metadata: { error: errorMessage },
        ipAddress,
      });

      throw AppError.internal(`Evidence processing failed: ${errorMessage}`);
    }
  }

  /**
   * Fetch processing status of an evidence document
   */
  static async getProcessingStatus(evidenceId: string, userId: string, role: UserRole) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        caseId: true,
        fileName: true,
        mimeType: true,
        hash: true,
        processingStatus: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        processingError: true,
        textExtractionStatus: true,
        nlpStatus: true,
      },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);
    return evidence;
  }

  /**
   * Get extracted text representation of evidence document
   */
  static async getExtractedText(evidenceId: string, userId: string, role: UserRole) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { document: true },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    if (!evidence.document) {
      throw AppError.notFound(`No extracted text document found for evidence '${evidenceId}'`);
    }

    return evidence.document;
  }

  /**
   * Get chunks of evidence document
   */
  static async getDocumentChunks(evidenceId: string, userId: string, role: UserRole) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    const chunks = await prisma.evidenceChunk.findMany({
      where: { evidenceId },
      orderBy: { chunkIndex: 'asc' },
    });

    return chunks;
  }

  /**
   * Get entity mentions extracted from evidence document with full provenance context
   */
  static async getEntityMentions(evidenceId: string, userId: string, role: UserRole) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw AppError.notFound(`Evidence with ID '${evidenceId}' not found`);
    }

    await CaseService.checkCaseAccess(evidence.caseId, userId, role);

    const mentions = await prisma.entityMention.findMany({
      where: { evidenceId },
      include: {
        entity: true,
        chunk: true,
        case: {
          select: { id: true, caseNumber: true, title: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return mentions;
  }

  /**
   * Directly process raw text input
   */
  static async processRawText(text: string, caseId: string, userId: string, role: UserRole) {
    await CaseService.checkCaseAccess(caseId, userId, role);
    const normalizedText = TextNormalizationService.normalizeDocumentText(text);
    const entities = await NlpService.extractEntities(normalizedText);

    return {
      metrics: {
        wordCount: normalizedText.split(/\s+/).filter((w) => w.length > 0).length,
        characterCount: normalizedText.length,
      },
      entitiesCount: entities.length,
      entities,
    };
  }
}
