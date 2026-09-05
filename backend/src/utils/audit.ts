import { prisma } from '../db/prisma';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

export async function createAuditLog(options: AuditLogOptions) {
  try {
    // Ensure sensitive fields (e.g. password, token) are NEVER present in metadata
    let safeMetadata = options.metadata ? { ...options.metadata } : undefined;
    if (safeMetadata) {
      delete safeMetadata.password;
      delete safeMetadata.passwordHash;
      delete safeMetadata.token;
      delete safeMetadata.authorization;
    }

    return await prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId || null,
        metadata: safeMetadata ? (safeMetadata as any) : undefined,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('[AUDIT_LOG_ERROR] Failed to record audit log:', err);
    // Audit log failure should not crash the primary request path
    return null;
  }
}
