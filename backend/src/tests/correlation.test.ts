import { describe, it, expect } from 'vitest';
import { CorrelationEngineService } from '../services/correlationEngine.service';
import { UserRole } from '@prisma/client';

describe('Phase 9: Cross-Case Correlation Engine', () => {
  it('should run cross-case correlation engine successfully', async () => {
    const result = await CorrelationEngineService.runCorrelation();
    expect(result).toBeDefined();
    expect(typeof result.processedCount).toBe('number');
    expect(Array.isArray(result.correlations)).toBe(true);
  });

  it('should fetch correlations filtered by RBAC for ADMIN', async () => {
    const correlations = await CorrelationEngineService.getCorrelations(UserRole.ADMIN, 'admin-id');
    expect(Array.isArray(correlations)).toBe(true);
  });
});
