import { describe, it, expect, beforeAll } from 'vitest';
import { TemporalAnalysisService } from '../services/temporalAnalysis.service';
import { GeospatialService } from '../services/geospatial.service';
import { PrismaClient, UserRole, CaseStatus, CasePriority } from '@prisma/client';

const prisma = new PrismaClient();

describe('Phase 18: Timeline & Geospatial Visualization Engine', () => {
  let testCaseId: string;
  let unassignedCaseId: string;
  let testUserId = 'test-user-p18';

  beforeAll(async () => {
    let adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    if (!adminUser) {
      adminUser = await prisma.user.findFirst();
    }
    const adminId = adminUser ? adminUser.id : 'admin-id';

    let invUser = await prisma.user.findFirst({ where: { role: UserRole.INVESTIGATOR } });
    if (!invUser) {
      invUser = await prisma.user.findFirst({ where: { id: { not: adminId } } });
    }
    if (invUser) {
      testUserId = invUser.id;
    }

    // Find or create test case
    let testCase = await prisma.case.findFirst({ where: { caseNumber: 'TEST-P18-001' } });
    if (!testCase) {
      testCase = await prisma.case.create({
        data: {
          caseNumber: 'TEST-P18-001',
          title: 'Timeline Geospatial Test Case',
          status: CaseStatus.OPEN,
          priority: CasePriority.HIGH,
          createdById: adminId,
        },
      });
    }
    testCaseId = testCase.id;

    let unassignedCase = await prisma.case.findFirst({ where: { caseNumber: 'TEST-P18-UNASSIGNED' } });
    if (!unassignedCase) {
      unassignedCase = await prisma.case.create({
        data: {
          caseNumber: 'TEST-P18-UNASSIGNED',
          title: 'Unassigned Test Case',
          status: CaseStatus.OPEN,
          priority: CasePriority.MEDIUM,
          createdById: adminId,
        },
      });
    }
    unassignedCaseId = unassignedCase.id;

    // Assign testUser to testCaseId
    await (prisma as any).caseAssignment.upsert({
      where: { caseId_userId: { caseId: testCaseId, userId: testUserId } },
      update: {},
      create: {
        caseId: testCaseId,
        userId: testUserId,
      },
    });
  });

  describe('Timeline Engine & Filtering', () => {
    it('should retrieve timeline items for admin user', async () => {
      const res = await TemporalAnalysisService.getFilteredTimeline(
        { caseId: testCaseId, page: 1, limit: 10 },
        UserRole.ADMIN,
        'admin-id'
      );
      expect(res).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
      expect(res.page).toBe(1);
    });

    it('should retrieve timeline items for assigned investigator', async () => {
      const res = await TemporalAnalysisService.getFilteredTimeline(
        { caseId: testCaseId, page: 1, limit: 10 },
        UserRole.INVESTIGATOR,
        testUserId
      );
      expect(res).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
    });

    it('should throw FORBIDDEN error if investigator accesses unassigned case', async () => {
      await expect(
        TemporalAnalysisService.getFilteredTimeline(
          { caseId: unassignedCaseId, page: 1, limit: 10 },
          UserRole.INVESTIGATOR,
          testUserId
        )
      ).rejects.toThrow('FORBIDDEN');
    });

    it('should respect chronological order sorting', async () => {
      const resAsc = await TemporalAnalysisService.getFilteredTimeline(
        { caseId: testCaseId, order: 'asc' },
        UserRole.ADMIN,
        'admin-id'
      );
      const resDesc = await TemporalAnalysisService.getFilteredTimeline(
        { caseId: testCaseId, order: 'desc' },
        UserRole.ADMIN,
        'admin-id'
      );

      expect(Array.isArray(resAsc.items)).toBe(true);
      expect(Array.isArray(resDesc.items)).toBe(true);

      if (resAsc.items.length > 1 && resAsc.items[0].timestamp !== 'UNKNOWN' && resAsc.items[1].timestamp !== 'UNKNOWN') {
        const time0 = new Date(resAsc.items[0].timestamp).getTime();
        const time1 = new Date(resAsc.items[1].timestamp).getTime();
        expect(time0).toBeLessThanOrEqual(time1);
      }
    });
  });

  describe('Geospatial Engine & Map Locations', () => {
    it('should retrieve map locations for admin user', async () => {
      const res = await GeospatialService.getMapLocations(
        { caseId: testCaseId, limit: 20 },
        UserRole.ADMIN,
        'admin-id'
      );
      expect(res).toBeDefined();
      expect(Array.isArray(res.locations)).toBe(true);
    });

    it('should throw FORBIDDEN error when non-admin accesses unassigned case locations', async () => {
      await expect(
        GeospatialService.getMapLocations(
          { caseId: unassignedCaseId },
          UserRole.INVESTIGATOR,
          testUserId
        )
      ).rejects.toThrow('FORBIDDEN');
    });

    it('should filter locations by bounding box if provided', async () => {
      const res = await GeospatialService.getMapLocations(
        {
          minLat: 10,
          maxLat: 30,
          minLng: 70,
          maxLng: 90,
          limit: 10,
        },
        UserRole.ADMIN,
        'admin-id'
      );
      expect(res).toBeDefined();
      expect(Array.isArray(res.locations)).toBe(true);
      for (const loc of res.locations) {
        expect(loc.latitude).toBeGreaterThanOrEqual(10);
        expect(loc.latitude).toBeLessThanOrEqual(30);
        expect(loc.longitude).toBeGreaterThanOrEqual(70);
        expect(loc.longitude).toBeLessThanOrEqual(90);
      }
    });
  });
});
