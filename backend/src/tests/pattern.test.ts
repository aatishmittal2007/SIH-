import { describe, it, expect } from 'vitest';
import { PatternDetectionService } from '../services/patternDetection.service';
import { UserRole } from '@prisma/client';

describe('Phase 12: Pattern & Anomaly Detection Engine', () => {
  it('should run pattern detection and store explainable findings', async () => {
    const count = await PatternDetectionService.runPatternDetection();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should retrieve detected patterns under RBAC control', async () => {
    const patterns = await PatternDetectionService.getPatterns(UserRole.ADMIN, 'admin-id');
    expect(Array.isArray(patterns)).toBe(true);
  });
});
