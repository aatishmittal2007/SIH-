import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export interface TimelineItem {
  id: string;
  timestamp: string; // ISO 8601 format or "UNKNOWN"
  endTimestamp?: string | null;
  type: string;
  description: string;
  confidence: number;
  case?: { id: string; caseNumber: string; title: string } | null;
  source?: { id: string; name: string; type: string } | null;
  location?: { entityId: string; displayName: string; latitude?: number | null; longitude?: number | null; address?: string | null } | null;
  involvedEntities?: Array<{ id: string; displayName: string; type: string }>;
  entityName?: string | null;
  evidenceTitle?: string | null;
  sourceName?: string | null;
  provenance: string;
}

export interface TimelineQueryOpts {
  caseId?: string;
  entityId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  minConfidence?: number;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TemporalAnalysisResult {
  caseId: string;
  totalEvents: number;
  timeRange: { start: string; end: string } | null;
  overlappingEvents: Array<{ eventId1: string; eventId2: string; timeDifferenceMinutes: number }>;
  activityWindows: Array<{ windowStart: string; windowEnd: string; eventCount: number }>;
  temporalGaps: Array<{ gapStart: string; gapEnd: string; gapDurationHours: number }>;
  temporalSignals: Array<{ signalType: string; description: string; score: number; provenance: string }>;
}

export class TemporalAnalysisService {
  /**
   * Get chronological timeline for a case
   */
  static async getCaseTimeline(caseId: string, userRole: string, userId: string): Promise<TimelineItem[]> {
    // RBAC Check
    if (userRole !== UserRole.ADMIN) {
      const assignment = await prisma.caseAssignment.findUnique({
        where: { caseId_userId: { caseId, userId } },
      });
      if (!assignment) {
        throw new Error('FORBIDDEN');
      }
    }

    const events = await prisma.event.findMany({
      where: { caseId },
      include: {
        source: true,
        locationEntity: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    const evidenceList = await prisma.evidence.findMany({
      where: { caseId },
      include: { source: true },
    });

    const items: TimelineItem[] = [];

    // Map Events to TimelineItems
    for (const ev of events) {
      items.push({
        id: ev.id,
        timestamp: ev.timestamp ? ev.timestamp.toISOString() : 'UNKNOWN',
        endTimestamp: ev.endTimestamp ? ev.endTimestamp.toISOString() : null,
        type: ev.type,
        description: ev.description,
        confidence: ev.confidence,
        entityName: ev.locationEntity ? ev.locationEntity.displayName : null,
        sourceName: ev.source ? ev.source.name : null,
        provenance: `Event ID ${ev.id} in Case ${caseId}`,
      });
    }

    // Map Evidence collection dates to TimelineItems
    for (const evd of evidenceList) {
      items.push({
        id: evd.id,
        timestamp: evd.collectedAt ? evd.collectedAt.toISOString() : 'UNKNOWN',
        type: `EVIDENCE_${evd.type}`,
        description: `Collected Evidence: ${evd.title} (${evd.fileName})`,
        confidence: 1.0,
        sourceName: evd.source ? evd.source.name : null,
        provenance: `Evidence ID ${evd.id} in Case ${caseId}`,
      });
    }

    // Sort items chronologically (items with 'UNKNOWN' timestamp go last)
    items.sort((a, b) => {
      if (a.timestamp === 'UNKNOWN') return 1;
      if (b.timestamp === 'UNKNOWN') return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return items;
  }

  /**
   * Perform temporal pattern analysis for a case
   */
  static async analyzeCaseTemporalPatterns(caseId: string, userRole: string, userId: string): Promise<TemporalAnalysisResult> {
    const timeline = await this.getCaseTimeline(caseId, userRole, userId);
    const validTimeItems = timeline.filter((t) => t.timestamp !== 'UNKNOWN');

    const overlappingEvents: Array<{ eventId1: string; eventId2: string; timeDifferenceMinutes: number }> = [];
    const temporalGaps: Array<{ gapStart: string; gapEnd: string; gapDurationHours: number }> = [];
    const temporalSignals: Array<{ signalType: string; description: string; score: number; provenance: string }> = [];

    if (validTimeItems.length === 0) {
      return {
        caseId,
        totalEvents: 0,
        timeRange: null,
        overlappingEvents: [],
        activityWindows: [],
        temporalGaps: [],
        temporalSignals: [
          {
            signalType: 'NO_TEMPORAL_DATA',
            description: 'No valid timestamped events available for analysis',
            score: 0,
            provenance: `Case ${caseId}`,
          },
        ],
      };
    }

    // Determine overall time range
    const timeRange = {
      start: validTimeItems[0].timestamp,
      end: validTimeItems[validTimeItems.length - 1].timestamp,
    };

    // Analyze overlapping & close proximity events
    for (let i = 0; i < validTimeItems.length - 1; i++) {
      const item1 = validTimeItems[i];
      const item2 = validTimeItems[i + 1];

      const t1 = new Date(item1.timestamp).getTime();
      const t2 = new Date(item2.timestamp).getTime();
      const diffMinutes = (t2 - t1) / (1000 * 60);

      if (diffMinutes <= 120) {
        // Events within 2 hours
        overlappingEvents.push({
          eventId1: item1.id,
          eventId2: item2.id,
          timeDifferenceMinutes: Math.round(diffMinutes),
        });
      }

      const diffHours = diffMinutes / 60;
      if (diffHours >= 72) {
        // Temporal gap > 3 days
        temporalGaps.push({
          gapStart: item1.timestamp,
          gapEnd: item2.timestamp,
          gapDurationHours: Math.round(diffHours),
        });
      }
    }

    if (overlappingEvents.length >= 2) {
      temporalSignals.push({
        signalType: 'HIGH_FREQUENCY_CLUSTER',
        description: `Multiple events (${overlappingEvents.length} pairs) occurred in close temporal proximity (<= 2 hours)`,
        score: 0.75,
        provenance: `Case ${caseId} temporal cluster`,
      });
    }

    if (temporalGaps.length >= 1) {
      temporalSignals.push({
        signalType: 'TEMPORAL_GAP_DETECTED',
        description: `Detected ${temporalGaps.length} major temporal activity gap(s) exceeding 72 hours`,
        score: 0.4,
        provenance: `Case ${caseId} activity gaps`,
      });
    }

    return {
      caseId,
      totalEvents: validTimeItems.length,
      timeRange,
      overlappingEvents,
      activityWindows: [
        {
          windowStart: timeRange.start,
          windowEnd: timeRange.end,
          eventCount: validTimeItems.length,
        },
      ],
      temporalGaps,
      temporalSignals,
    };
  }

  /**
   * Get filtered timeline across assigned cases with pagination & filters
   */
  static async getFilteredTimeline(
    opts: TimelineQueryOpts,
    userRole: string,
    userId: string
  ): Promise<{ items: TimelineItem[]; total: number; page: number; limit: number }> {
    const page = opts.page && opts.page > 0 ? Number(opts.page) : 1;
    const limit = opts.limit && opts.limit > 0 ? Math.min(Number(opts.limit), 100) : 50;

    let allowedCaseIds: string[] | null = null;
    if (userRole !== UserRole.ADMIN) {
      const assignments = await prisma.caseAssignment.findMany({
        where: { userId },
        select: { caseId: true },
      });
      allowedCaseIds = assignments.map((a) => a.caseId);

      if (opts.caseId) {
        if (Array.isArray(allowedCaseIds) && !allowedCaseIds.includes(opts.caseId)) {
          throw new Error('FORBIDDEN');
        }
      } else if (Array.isArray(allowedCaseIds) && allowedCaseIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
    }

    const eventWhere: any = {};
    if (opts.caseId) {
      eventWhere.caseId = opts.caseId;
    } else if (allowedCaseIds !== null) {
      eventWhere.caseId = { in: allowedCaseIds };
    }

    if (opts.eventType && !opts.eventType.startsWith('EVIDENCE')) {
      eventWhere.type = opts.eventType;
    }

    if (opts.minConfidence !== undefined) {
      eventWhere.confidence = { gte: Number(opts.minConfidence) };
    }

    if (opts.startDate || opts.endDate) {
      eventWhere.timestamp = {};
      if (opts.startDate) eventWhere.timestamp.gte = new Date(opts.startDate);
      if (opts.endDate) eventWhere.timestamp.lte = new Date(opts.endDate);
    }

    if (opts.entityId) {
      eventWhere.OR = [
        { locationEntityId: opts.entityId },
        { case: { caseEntities: { some: { entityId: opts.entityId } } } },
      ];
    }

    const events = await prisma.event.findMany({
      where: eventWhere,
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        source: { select: { id: true, name: true, type: true } },
        locationEntity: {
          include: {
            locations: true,
          },
        },
      },
      orderBy: { timestamp: opts.order === 'desc' ? 'desc' : 'asc' },
    });

    const items: TimelineItem[] = [];

    for (const ev of events) {
      const locData = ev.locationEntity?.locations?.[0];
      items.push({
        id: ev.id,
        timestamp: ev.timestamp ? ev.timestamp.toISOString() : 'UNKNOWN',
        endTimestamp: ev.endTimestamp ? ev.endTimestamp.toISOString() : null,
        type: ev.type,
        description: ev.description,
        confidence: ev.confidence,
        case: ev.case,
        source: ev.source ? { id: ev.source.id, name: ev.source.name, type: ev.source.type } : null,
        location: ev.locationEntity
          ? {
              entityId: ev.locationEntity.id,
              displayName: ev.locationEntity.displayName,
              latitude: locData ? locData.latitude : null,
              longitude: locData ? locData.longitude : null,
              address: locData ? locData.address : null,
            }
          : null,
        provenance: `Event ID ${ev.id} in Case ${ev.case.caseNumber}`,
      });
    }

    // Also include Evidence collection events if applicable
    if (!opts.eventType || opts.eventType.startsWith('EVIDENCE')) {
      const evidenceWhere: any = {};
      if (opts.caseId) {
        evidenceWhere.caseId = opts.caseId;
      } else if (allowedCaseIds !== null) {
        evidenceWhere.caseId = { in: allowedCaseIds };
      }

      if (opts.startDate || opts.endDate) {
        evidenceWhere.collectedAt = {};
        if (opts.startDate) evidenceWhere.collectedAt.gte = new Date(opts.startDate);
        if (opts.endDate) evidenceWhere.collectedAt.lte = new Date(opts.endDate);
      }

      if (opts.entityId) {
        evidenceWhere.entityMentions = { some: { entityId: opts.entityId } };
      }

      const evidenceList = await prisma.evidence.findMany({
        where: evidenceWhere,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          source: { select: { id: true, name: true, type: true } },
          entityMentions: { include: { entity: true } },
        },
      });

      for (const evd of evidenceList) {
        items.push({
          id: evd.id,
          timestamp: evd.collectedAt ? evd.collectedAt.toISOString() : 'UNKNOWN',
          type: `EVIDENCE_${evd.type}`,
          description: `Collected Evidence: ${evd.title} (${evd.fileName})`,
          confidence: 1.0,
          case: evd.case,
          source: evd.source ? { id: evd.source.id, name: evd.source.name, type: evd.source.type } : null,
          involvedEntities: evd.entityMentions.map((em: any) => ({
            id: em.entity.id,
            displayName: em.entity.displayName,
            type: em.entity.type,
          })),
          provenance: `Evidence ID ${evd.id} in Case ${evd.case.caseNumber}`,
        });
      }
    }

    // Sort items chronologically according to order
    const isDesc = opts.order === 'desc';
    items.sort((a, b) => {
      if (a.timestamp === 'UNKNOWN') return 1;
      if (b.timestamp === 'UNKNOWN') return -1;
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return isDesc ? tB - tA : tA - tB;
    });

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
    };
  }
}
