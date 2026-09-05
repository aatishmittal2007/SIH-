import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { EvidenceService } from './evidence.service';
import { createEvidenceSchema, updateEvidenceSchema, getEvidenceQuerySchema } from './evidence.schema';
import { AppError } from '../../utils/errors';
import { IngestionService } from '../../services/ingestion.service';
import { z } from 'zod';

export class EvidenceController {
  static async upload(req: AuthRequest, res: Response) {
    if (!req.file) {
      throw AppError.badRequest('No evidence file provided');
    }

    let parsedBody = req.body;
    if (typeof req.body.metadata === 'string') {
      try {
        parsedBody.metadata = JSON.parse(req.body.metadata);
      } catch (e) {
        parsedBody.metadata = {};
      }
    }

    const input = createEvidenceSchema.parse(parsedBody);
    const userId = req.user!.id;
    const role = req.user!.role;

    const evidence = await EvidenceService.uploadEvidence(
      input,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      role,
      req.ip
    );

    res.status(201).json(evidence);
  }

  static async list(req: AuthRequest, res: Response) {
    const queryParams = getEvidenceQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await EvidenceService.listEvidence(queryParams, userId, role);
    res.json(result);
  }

  static async getById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const evidence = await EvidenceService.getEvidenceById(id, userId, role);
    res.json(evidence);
  }

  static async download(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const { stream, evidence, integrityValid } = await EvidenceService.getEvidenceFileForDownload(
      id,
      userId,
      role,
      req.ip
    );

    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${evidence.fileName}"`);
    res.setHeader('X-Evidence-SHA256', evidence.hash || '');
    res.setHeader('X-Integrity-Verified', String(integrityValid));

    stream.pipe(res);
  }

  static async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const input = updateEvidenceSchema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;

    const updated = await EvidenceService.updateEvidence(id, input, userId, role, req.ip);
    res.json(updated);
  }

  static async delete(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await EvidenceService.deleteEvidence(id, userId, role, req.ip);
    res.json(result);
  }

  /**
   * Phase 5 API: Process uploaded evidence file via NLP/NER pipeline
   */
  static async processEvidence(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await IngestionService.processEvidence(id, userId, role, req.ip);
    res.json({
      success: true,
      data: result,
    });
  }

  /**
   * Phase 5 API: Fetch evidence processing status
   */
  static async getProcessingStatus(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const status = await IngestionService.getProcessingStatus(id, userId, role);
    res.json({
      success: true,
      data: status,
    });
  }

  /**
   * Phase 5 API: Get extracted text document
   */
  static async getExtractedText(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const document = await IngestionService.getExtractedText(id, userId, role);
    res.json({
      success: true,
      data: document,
    });
  }

  /**
   * Phase 5 API: Get document chunks
   */
  static async getChunks(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const chunks = await IngestionService.getDocumentChunks(id, userId, role);
    res.json({
      success: true,
      data: chunks,
    });
  }

  /**
   * Phase 5 API: Get extracted entity mentions for evidence document
   */
  static async getEntityMentions(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const mentions = await IngestionService.getEntityMentions(id, userId, role);
    res.json({
      success: true,
      data: mentions,
    });
  }

  /**
   * Phase 5 API: Directly extract entities from raw text input
   */
  static async processRawText(req: AuthRequest, res: Response) {
    const schema = z.object({
      text: z.string().min(1, 'Text content is required'),
      caseId: z.string().min(1, 'Case ID is required'),
    });

    const { text, caseId } = schema.parse(req.body);
    const userId = req.user!.id;
    const role = req.user!.role;

    const result = await IngestionService.processRawText(text, caseId, userId, role);
    res.json({
      success: true,
      data: result,
    });
  }
}
