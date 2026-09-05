import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export interface MapLocationItem {
  id: string;
  entityId: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  entity: {
    id: string;
    displayName: string;
    type: string;
    canonicalValue: string;
  };
  cases: Array<{ id: string; caseNumber: string; title: string }>;
  events: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    confidence: number;
  }>;
  provenance: string;
}

export interface MapQueryOpts {
  caseId?: string;
  entityId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  minConfidence?: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  limit?: number;
}

export class GeospatialService {
  /**
   * Get locations with coordinates, associated entities, events, and cases
   */
  static async getMapLocations(
    opts: MapQueryOpts,
    userRole: string,
    userId: string
  ): Promise<{ locations: MapLocationItem[]; total: number }> {
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
        return { locations: [], total: 0 };
      }
    }

    const whereLocation: any = {};
    if (opts.minLat !== undefined && opts.maxLat !== undefined) {
      whereLocation.latitude = { gte: Number(opts.minLat), lte: Number(opts.maxLat) };
    }
    if (opts.minLng !== undefined && opts.maxLng !== undefined) {
      whereLocation.longitude = { gte: Number(opts.minLng), lte: Number(opts.maxLng) };
    }

    if (opts.entityId) {
      whereLocation.entityId = opts.entityId;
    }

    const whereEntity: any = {};
    if (opts.caseId) {
      whereEntity.caseEntities = { some: { caseId: opts.caseId } };
    } else if (allowedCaseIds !== null) {
      whereEntity.caseEntities = { some: { caseId: { in: allowedCaseIds } } };
    }

    whereLocation.entity = whereEntity;

    const limit = opts.limit && opts.limit > 0 ? Math.min(Number(opts.limit), 500) : 200;

    const locations = await prisma.location.findMany({
      where: whereLocation,
      include: {
        entity: {
          include: {
            caseEntities: {
              include: {
                case: { select: { id: true, caseNumber: true, title: true } },
              },
            },
            eventLocations: {
              include: {
                case: { select: { id: true, caseNumber: true, title: true } },
              },
            },
          },
        },
      },
      take: limit,
    });

    const items: MapLocationItem[] = [];

    for (const loc of locations) {
      // Validate lat/lng range
      if (
        loc.latitude === null ||
        loc.longitude === null ||
        isNaN(loc.latitude) ||
        isNaN(loc.longitude) ||
        loc.latitude < -90 ||
        loc.latitude > 90 ||
        loc.longitude < -180 ||
        loc.longitude > 180
      ) {
        continue;
      }

      // Collect cases from entity caseEntities & eventLocations
      const caseMap = new Map<string, { id: string; caseNumber: string; title: string }>();
      for (const ce of loc.entity.caseEntities) {
        if (!allowedCaseIds || allowedCaseIds.includes(ce.caseId)) {
          caseMap.set(ce.case.id, ce.case);
        }
      }
      for (const ev of loc.entity.eventLocations) {
        if (ev.case && (!allowedCaseIds || allowedCaseIds.includes(ev.caseId))) {
          caseMap.set(ev.case.id, ev.case);
        }
      }

      const caseList = Array.from(caseMap.values());
      // If user is restricted to a caseId filter, ensure this location belongs to it
      if (opts.caseId && !caseList.some((c) => c.id === opts.caseId)) {
        continue;
      }

      // Collect events at this location
      const eventsList = loc.entity.eventLocations
        .filter((ev) => {
          if (opts.caseId && ev.caseId !== opts.caseId) return false;
          if (allowedCaseIds && !allowedCaseIds.includes(ev.caseId)) return false;
          if (opts.eventType && ev.type !== opts.eventType) return false;
          if (opts.minConfidence && ev.confidence < opts.minConfidence) return false;
          if (opts.startDate && ev.timestamp && new Date(ev.timestamp) < new Date(opts.startDate)) return false;
          if (opts.endDate && ev.timestamp && new Date(ev.timestamp) > new Date(opts.endDate)) return false;
          return true;
        })
        .map((ev) => ({
          id: ev.id,
          type: ev.type,
          description: ev.description,
          timestamp: ev.timestamp ? ev.timestamp.toISOString() : 'UNKNOWN',
          confidence: ev.confidence,
        }));

      items.push({
        id: loc.id,
        entityId: loc.entityId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        entity: {
          id: loc.entity.id,
          displayName: loc.entity.displayName,
          type: loc.entity.type,
          canonicalValue: loc.entity.canonicalValue,
        },
        cases: caseList,
        events: eventsList,
        provenance: `Location ID ${loc.id} (Entity: ${loc.entity.displayName})`,
      });
    }

    return {
      locations: items,
      total: items.length,
    };
  }
}
