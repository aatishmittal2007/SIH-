import { describe, it, expect } from 'vitest';
import { DashboardService } from '../services/dashboard.service';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';

describe('Phase 16: Investigator Intelligence Dashboard Suite', () => {
  let adminUserId: string;
  let investigatorUserId: string;
  let assignedCaseId: string;

  it('should resolve or create users and case assignments for dashboard testing', async () => {
    // Resolve admin user
    let admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Dashboard Admin',
          email: 'dash-admin@tracex.local',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
          role: UserRole.ADMIN,
        },
      });
    }
    adminUserId = admin.id;

    // Resolve investigator user
    let investigator = await prisma.user.findFirst({ where: { role: UserRole.INVESTIGATOR } });
    if (!investigator) {
      investigator = await prisma.user.create({
        data: {
          name: 'Dashboard Investigator',
          email: 'dash-investigator@tracex.local',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
          role: UserRole.INVESTIGATOR,
        },
      });
    }
    investigatorUserId = investigator.id;

    // Create assigned case for investigator
    const testCase = await prisma.case.create({
      data: {
        caseNumber: `DASH-TEST-${Date.now()}`,
        title: 'Dashboard Test Case',
        description: 'Case for testing investigator dashboard aggregation',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: adminUserId,
      },
    });
    assignedCaseId = testCase.id;

    await prisma.caseAssignment.create({
      data: {
        caseId: assignedCaseId,
        userId: investigatorUserId,
        assignedById: adminUserId,
      },
    });

    expect(assignedCaseId).toBeDefined();
  });

  it('DashboardService.getDashboardSummary should return aggregated intelligence for ADMIN', async () => {
    const summary = await DashboardService.getDashboardSummary(adminUserId, UserRole.ADMIN);

    expect(summary).toBeDefined();
    expect(summary.user.id).toBe(adminUserId);
    expect(summary.user.role).toBe(UserRole.ADMIN);

    // Verify metrics structure
    expect(summary.metrics).toBeDefined();
    expect(typeof summary.metrics.totalCases).toBe('number');
    expect(typeof summary.metrics.openCases).toBe('number');
    expect(typeof summary.metrics.totalEvidence).toBe('number');
    expect(typeof summary.metrics.pendingEntityMatches).toBe('number');
    expect(typeof summary.metrics.activeCorrelations).toBe('number');
    expect(typeof summary.metrics.activeContradictions).toBe('number');
    expect(typeof summary.metrics.activeFindings).toBe('number');

    // Verify lists return arrays
    expect(Array.isArray(summary.assignedCases)).toBe(true);
    expect(Array.isArray(summary.recentEvidence)).toBe(true);
    expect(Array.isArray(summary.pendingEntityMatches)).toBe(true);
    expect(Array.isArray(summary.correlationCandidates)).toBe(true);
    expect(Array.isArray(summary.anomaliesAndPatterns)).toBe(true);
    expect(Array.isArray(summary.contradictions)).toBe(true);
    expect(Array.isArray(summary.intelligenceFindings)).toBe(true);
    expect(Array.isArray(summary.recentActivity)).toBe(true);
    expect(Array.isArray(summary.alerts)).toBe(true);

    // Check epistemological labels
    if (summary.recentEvidence.length > 0) {
      expect(summary.recentEvidence[0].label).toBe('CONFIRMED DATA');
    }
    if (summary.pendingEntityMatches.length > 0) {
      expect(summary.pendingEntityMatches[0].label).toBe('CANDIDATE');
    }
    if (summary.contradictions.length > 0) {
      expect(summary.contradictions[0].label).toBe('CONTRADICTION');
    }
    if (summary.intelligenceFindings.length > 0) {
      expect(summary.intelligenceFindings[0].label).toBe('ANALYTICAL SIGNAL');
    }
  });

  it('DashboardService.getDashboardSummary should scope cases for INVESTIGATOR role', async () => {
    const summary = await DashboardService.getDashboardSummary(investigatorUserId, UserRole.INVESTIGATOR);

    expect(summary).toBeDefined();
    expect(summary.user.id).toBe(investigatorUserId);
    expect(summary.user.role).toBe(UserRole.INVESTIGATOR);

    // Verify case scoping - investigator should see assigned case
    const foundAssigned = summary.assignedCases.some((c) => c.id === assignedCaseId);
    expect(foundAssigned).toBe(true);
  });
});
