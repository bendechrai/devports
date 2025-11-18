import { describe, it, expect } from 'vitest';
import { checkPortInUse, findAvailablePort } from '../src/port-utils.js';

describe('port-utils', () => {
  describe('checkPortInUse', () => {
    it('should return boolean for high port numbers (likely unused)', async () => {
      const result1 = await checkPortInUse(65432);
      const result2 = await checkPortInUse(65433, 'localhost');

      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });

    it('should return false for invalid hosts', async () => {
      // Test with an invalid host that doesn't exist
      const result = await checkPortInUse(
        3000,
        'invalid.host.that.does.not.exist.anywhere.com'
      );
      expect(result).toBe(false);
    }, 10000);

    it('should handle localhost as default host', async () => {
      const result = await checkPortInUse(65434);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('findAvailablePort', () => {
    it('should return null when all ports in range are devports-allocated', async () => {
      const usedPorts = new Set([3000, 3001, 3002, 3003, 3004]);
      const result = await findAvailablePort(3000, 3004, usedPorts);

      expect(result).toBe(null);
    });

    it('should skip devports-allocated ports and find available ones', async () => {
      const usedPorts = new Set([65430, 65432]);
      const result = await findAvailablePort(65430, 65434, usedPorts);

      // Should find one of the non-allocated ports (65431, 65433, or 65434)
      expect(result).toBeGreaterThanOrEqual(65431);
      expect(result).toBeLessThanOrEqual(65434);
      expect(usedPorts.has(result!)).toBe(false);
    }, 15000);

    it('should work with single port range when port is allocated', async () => {
      const usedPorts = new Set([65435]);
      const result = await findAvailablePort(65435, 65435, usedPorts);

      expect(result).toBe(null);
    });

    it('should work with single port range when port is available', async () => {
      const usedPorts = new Set<number>();
      const result = await findAvailablePort(65436, 65436, usedPorts);

      // Should either return the port (if available) or null (if in use)
      expect(result === null || result === 65436).toBe(true);
    }, 10000);

    it('should use custom host when provided', async () => {
      const usedPorts = new Set<number>();

      // This should complete without throwing, even with an invalid host
      // The function should return null when it can't connect to the host
      const result = await findAvailablePort(
        65437,
        65437,
        usedPorts,
        'invalid.test.host'
      );

      // With an invalid host, all ports should appear "available" (connection fails)
      expect(result).toBe(65437);
    }, 10000);

    it('should handle empty port range', async () => {
      const usedPorts = new Set<number>();

      // When start > end, should return null
      const result = await findAvailablePort(3002, 3000, usedPorts);
      expect(result).toBe(null);
    });

    it('should find available port when some are in use', async () => {
      const usedPorts = new Set([65440, 65442]);

      // Should find 65441 or 65443 (the non-allocated ones)
      const result = await findAvailablePort(65440, 65443, usedPorts);

      expect(result).toBeTruthy();
      expect([65441, 65443]).toContain(result);
    }, 15000);
  });
});
