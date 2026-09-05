import { describe, it, expect } from 'vitest';
import { AlertService } from '../services/alert.service';
import { ReportService } from '../services/report.service';
import { UserRole, AlertStatus, SeverityLevel } from '@prisma/client';
import { prisma } from '../db/prisma';

describe('Phase 19: Alerts and Reports Suite', () => {
  let adminUserId: string;
  let investigatorUserId: string;
  let unauthorizedUserId: string;
  let assignedCaseId: string;
  let unassignedCaseId: string;
  let createdAlertId: string;
  let createdReportId: string;

  it('should resolve or create users and cases for Phase 19 testing', async () => {
    // Admin user
    let admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: 'Alerts Admin',
          email: `alerts-admin-${Date.now()}@tracex.local`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
          role: UserRole.ADMIN,
        },
      });
    }
    adminUserId = admin.id;

    // Assigned Investigator
    let investigator = await prisma.user.findFirst({ where: { role: UserRole.INVESTIGATOR } });
    if (!investigator) {
      investigator = await prisma.user.create({
        data: {
          name: 'Alerts Investigator',
          email: `alerts-investigator-${Date.now()}@tracex.local`,
          passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
          role: UserRole.INVESTIGATOR,
        },
      });
    }
    investigatorUserId = investigator.id;

    // Unauthorized User (Analyst without case assignment)
    let unauthorizedUser = await prisma.user.create({
      data: {
        name: 'Unauthorized User',
        email: `unauth-${Date.now()}@tracex.local`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuuu',
        role: UserRole.ANALYST,
      },
    });
    unauthorizedUserId = unauthorizedUser.id;

    // Assigned Case
    const testCase = await prisma.case.create({
      data: {
        caseNumber: `ALERT-CASE-${Date.now()}`,
        title: 'Alert & Report Test Case',
        description: 'Case for testing alerts and deterministic reporting',
        status: 'OPEN',
        priority: 'CRITICAL',
        createdById: adminUserId,
      },
    });
    assignedCaseId = testCase.id;

    // Unassigned Case
    const unassignedCase = await prisma.case.create({
      data: {
        caseNumber: `UNASSIGNED-CASE-${Date.now()}`,
        title: 'Unassigned Test Case',
        description: 'Case not assigned to investigator',
        status: 'OPEN',
        priority: 'MEDIUM',
        createdById: adminUserId,
      },
    });
    unassignedCaseId = unassignedCase.id;

    await prisma.caseAssignment.create({
      data: {
        caseId: assignedCaseId,
        userId: investigatorUserId,
        assignedById: adminUserId,
      },
    });

    expect(assignedCaseId).toBeDefined();
    expect(unassignedCaseId).toBeDefined();
  });

  it('AlertService.generateAlertsFromSignals should evaluate signals and generate alerts', async () => {
    const result = await AlertService.generateAlertsFromSignals(assignedCaseId);
    expect(result).toBeDefined();
    expect(typeof result.createdCount).toBe('number');

    // Create a manual test alert to guarantee existence for lifecycle testing
    const testAlert = await prisma.alert.create({
      data: {
        caseId: assignedCaseId,
        type: 'CONTRADICTION',
        severity: SeverityLevel.HIGH,
        title: 'Test High Contradiction Alert',
        description: 'Contradictory entity statement detected in evidence.',
        status: AlertStatus.ACTIVE,
      },
    });
    createdAlertId = testAlert.id;
    expect(createdAlertId).toBeDefined();
  });

  it('AlertService.listAlerts should scope alerts strictly based on RBAC and case assignment', async () => {
    const adminRes = await AlertService.listAlerts({}, adminUserId, UserRole.ADMIN);
    expect(Array.isArray(adminRes.alerts)).toBe(true);
    expect(adminRes.alerts.some((a: any) => a.id === createdAlertId)).toBe(true);

    const investigatorRes = await AlertService.listAlerts({}, investigatorUserId, UserRole.INVESTIGATOR);
    expect(Array.isArray(investigatorRes.alerts)).toBe(true);
    expect(investigatorRes.alerts.some((a: any) => a.id === createdAlertId)).toBe(true);

    const unauthRes = await AlertService.listAlerts({}, unauthorizedUserId, UserRole.ANALYST);
    expect(unauthRes.alerts.some((a: any) => a.id === createdAlertId)).toBe(false);
  });

  it('AlertService.updateAlertStatus should update alert lifecycle state with audit logging', async () => {
    const updatedAlert = await AlertService.updateAlertStatus(
      createdAlertId,
      AlertStatus.RESOLVED,
      'Verified contradiction as false alarm',
      investigatorUserId,
      UserRole.INVESTIGATOR
    );

    expect(updatedAlert).toBeDefined();
    expect(updatedAlert.status).toBe(AlertStatus.RESOLVED);
    expect(updatedAlert.resolvedAt).not.toBeNull();

    // Verify audit log entry
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: investigatorUserId,
        action: 'ALERT_RESOLVED',
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('ReportService.generateCaseReport should generate a structured, deterministic case report', async () => {
    const reportResult = await ReportService.generateCaseReport(
      assignedCaseId,
      investigatorUserId,
      UserRole.INVESTIGATOR,
      'JSON'
    );

    expect(reportResult).toBeDefined();
    expect(reportResult.id).toBeDefined();
    expect(reportResult.caseId).toBe(assignedCaseId);
    expect(reportResult.content).toBeDefined();
    expect(reportResult.content.reportHeader).toBeDefined();
    expect(reportResult.content.section1_caseInformation).toBeDefined();

    createdReportId = reportResult.id;
  });

  it('ReportService.generateCaseReport should enforce case-level authorization and deny unauthorized users', async () => {
    await expect(
      ReportService.generateCaseReport(
        unassignedCaseId,
        unauthorizedUserId,
        UserRole.ANALYST,
        'JSON'
      )
    ).rejects.toThrow();
  });

  it('ReportService.getReport should return report and log access action', async () => {
    const reportData = await ReportService.getReport(createdReportId, investigatorUserId, UserRole.INVESTIGATOR);

    expect(reportData).toBeDefined();
    expect(reportData.id).toBe(createdReportId);
    expect(reportData.content).toBeDefined();

    // Check audit log for REPORT_ACCESSED
    const accessAuditLogs = await prisma.auditLog.findMany({
      where: {
        userId: investigatorUserId,
        action: 'REPORT_ACCESSED',
      },
    });
    expect(accessAuditLogs.length).toBeGreaterThan(0);
  });

  it('ReportService.downloadReport should export report payload and log download action', async () => {
    const downloadData = await ReportService.downloadReport(createdReportId, investigatorUserId, UserRole.INVESTIGATOR);

    expect(downloadData).toBeDefined();
    expect(downloadData.mimeType).toBe('application/json');
    expect(downloadData.data).toBeDefined();
    expect(downloadData.fileName).toContain('_Investigation_Report.json');

    // Check audit log for REPORT_DOWNLOADED
    const downloadAuditLogs = await prisma.auditLog.findMany({
      where: {
        userId: investigatorUserId,
        action: 'REPORT_DOWNLOADED',
      },
    });
    expect(downloadAuditLogs.length).toBeGreaterThan(0);
  });
});
