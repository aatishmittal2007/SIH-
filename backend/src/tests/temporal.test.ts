import { describe, it, expect } from 'vitest';
import { TemporalAnalysisService } from '../services/temporalAnalysis.service';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

describe('Phase 10: Temporal Analysis Engine', () => {
  it('should generate case timeline and perform temporal analysis', async () => {
    const caseObj = await prisma.case.findFirst();
    if (caseObj) {
      const timeline = await TemporalAnalysisService.getCaseTimeline(caseObj.id, UserRole.ADMIN, 'admin-id');
      expect(Array.isArray(timeline)).toBe(true);

      const analysis = await TemporalAnalysisService.analyzeCaseTemporalPatterns(caseObj.id, UserRole.ADMIN, 'admin-id');
      expect(analysis).toBeDefined();
      expect(analysis.caseId).toBe(caseObj.id);
      expect(Array.isArray(analysis.overlappingEvents)).toBe(true);
      expect(Array.isArray(analysis.temporalSignals)).toBe(true);
    }
  });
});
