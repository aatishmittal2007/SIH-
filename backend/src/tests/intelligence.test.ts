import { describe, it, expect } from 'vitest';
import { ContradictionDetectionService } from '../services/contradictionDetection.service';
import { IntelligenceEngineService } from '../services/intelligenceEngine.service';
import { PathFinderService } from '../services/pathFinder.service';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';

describe('Phases 13–15: Advanced Investigation Intelligence Suite', () => {
  let testCaseId: string;
  let testSourceEntityId: string;
  let testTargetEntityId: string;

  it('should set up or retrieve test fixtures', async () => {
    let testCase = await prisma.case.findFirst();
    if (!testCase) {
      const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
      testCase = await prisma.case.create({
        data: {
          caseNumber: 'TEST-INT-001',
          title: 'Intelligence Test Case',
          description: 'Testing contradiction and intelligence generation',
          status: 'OPEN',
          createdById: adminUser?.id || 'admin',
        },
      });
    }
    testCaseId = testCase.id;

    const entities = await prisma.entity.findMany({ take: 2 });
    if (entities.length >= 2) {
      testSourceEntityId = entities[0].id;
      testTargetEntityId = entities[1].id;
    } else {
      const e1 = await prisma.entity.create({
        data: {
          displayName: 'Entity Alpha',
          canonicalValue: 'Entity Alpha',
          normalizedValue: 'entity alpha',
          type: 'PERSON',
        },
      });
      const e2 = await prisma.entity.create({
        data: {
          displayName: 'Entity Beta',
          canonicalValue: 'Entity Beta',
          normalizedValue: 'entity beta',
          type: 'ORGANIZATION',
        },
      });
      testSourceEntityId = e1.id;
      testTargetEntityId = e2.id;
    }

    expect(testCaseId).toBeDefined();
  });

  it('Phase 13: ContradictionDetectionService should detect and return contradictions', async () => {
    const res = await ContradictionDetectionService.detectContradictions(
      testCaseId,
      UserRole.ADMIN,
      'admin-id'
    );
    expect(res).toBeDefined();
    expect(typeof res.detectedCount).toBe('number');
    expect(Array.isArray(res.contradictions)).toBe(true);

    const contradictions = await ContradictionDetectionService.getContradictions(
      testCaseId,
      UserRole.ADMIN,
      'admin-id'
    );
    expect(Array.isArray(contradictions)).toBe(true);
  });

  it('Phase 14: IntelligenceEngineService should synthesize intelligence findings', async () => {
    const result = await IntelligenceEngineService.generateFindingsForCase(
      testCaseId,
      UserRole.ADMIN,
      'admin-id'
    );
    expect(result).toBeDefined();
    expect(typeof result.generatedCount).toBe('number');
    expect(Array.isArray(result.findings)).toBe(true);

    const findings = await IntelligenceEngineService.getFindingsByCase(
      testCaseId,
      UserRole.ADMIN,
      'admin-id'
    );
    expect(Array.isArray(findings)).toBe(true);
  });

  it('Phase 15: PathFinderService should discover investigation paths between entities', async () => {
    const result = await PathFinderService.findPath(
      testSourceEntityId,
      testTargetEntityId,
      5,
      UserRole.ADMIN,
      'admin-id'
    );
    expect(result).toBeDefined();
    expect(result.sourceEntity.id).toBe(testSourceEntityId);
    expect(result.targetEntity.id).toBe(testTargetEntityId);
    expect(typeof result.pathFound).toBe('boolean');
    expect(Array.isArray(result.pathNodes)).toBe(true);
  });
});
