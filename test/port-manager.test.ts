import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  allocatePort,
  releasePort,
  listAllocations,
  getStatus,
  reservePort,
  unreservePort,
  releasePortByNumber,
} from '../src/port-manager.js';

// Use a temp directory for testing
let TEST_CONFIG_DIR: string;

describe('Port Manager', () => {
  beforeEach(() => {
    // Create unique test config directory for each test
    TEST_CONFIG_DIR = join(
      tmpdir(),
      'devports-test-' +
        Date.now() +
        '-' +
        Math.random().toString(36).substring(2)
    );
    process.env.DEVPORTS_CONFIG_DIR = TEST_CONFIG_DIR;

    // Create test directory
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }

    // Reset environment variable
    delete process.env.DEVPORTS_CONFIG_DIR;
  });

  it('should allocate a port', async () => {
    const port = await allocatePort('test-project', 'postgres', 'postgres');
    expect(port).toBeGreaterThanOrEqual(5432);
    expect(port).toBeLessThanOrEqual(5499);
  });

  it('should not allocate duplicate ports', async () => {
    await allocatePort('test-project', 'postgres', 'postgres');

    await expect(
      allocatePort('test-project', 'postgres', 'postgres')
    ).rejects.toThrow(/already allocated/);
  });

  it('should validate port types', async () => {
    await expect(
      allocatePort('test-project', 'invalid', 'nonexistent')
    ).rejects.toThrow(/No port range configured/);
  });

  it('should provide helpful error for invalid types', async () => {
    try {
      await allocatePort('test', 'db', 'badtype');
    } catch (error) {
      expect((error as Error).message).toContain('Valid types:');
      expect((error as Error).message).toContain('postgres');
    }
  });

  it('should release a port', async () => {
    await allocatePort('test-project', 'postgres', 'postgres');
    const released = await releasePort('test-project', 'postgres');
    expect(released).toBe(1);
  });

  it('should release all ports for a project', async () => {
    await allocatePort('test-project', 'postgres', 'postgres');
    await allocatePort('test-project', 'api', 'api');

    const released = await releasePort('test-project', undefined, true);
    expect(released).toBe(2);
  });

  it('should list allocations', async () => {
    await allocatePort('project1', 'postgres', 'postgres');
    await allocatePort('project2', 'postgres', 'postgres');

    const allocations = listAllocations();
    expect(allocations.length).toBe(2);
  });

  it('should filter allocations by project', async () => {
    await allocatePort('project1', 'postgres', 'postgres');
    await allocatePort('project2', 'postgres', 'postgres');

    const allocations = listAllocations({ project: 'project1' });
    expect(allocations.length).toBe(1);
    expect(allocations[0].project).toBe('project1');
  });

  it('should filter allocations by type', async () => {
    await allocatePort('project1', 'postgres', 'postgres');
    await allocatePort('project1', 'api', 'api');

    const allocations = listAllocations({ type: 'postgres' });
    expect(allocations.length).toBe(1);
    expect(allocations[0].type).toBe('postgres');
  });

  it('should show status', () => {
    const status = getStatus();
    expect(status.types.postgres).toBeDefined();
    expect(status.types.postgres.next).toBeGreaterThanOrEqual(5432);
  });

  it('should allocate different port types', async () => {
    const pgPort = await allocatePort('test', 'postgres', 'postgres');
    const apiPort = await allocatePort('test', 'api', 'api');

    expect(pgPort).toBeGreaterThanOrEqual(5432);
    expect(apiPort).toBeGreaterThanOrEqual(3000);
    expect(apiPort).toBeLessThan(pgPort); // API ports are in lower range
  });

  it('should allocate sequential ports', async () => {
    const port1 = await allocatePort('project1', 'postgres', 'postgres');
    const port2 = await allocatePort('project2', 'postgres', 'postgres');

    // Ports should be different and in the postgres range
    expect(port2).not.toBe(port1);
    expect(port2).toBeGreaterThan(port1);
    expect(port1).toBeGreaterThanOrEqual(5432);
    expect(port2).toBeLessThanOrEqual(5499);
  });

  it('should reserve a port', async () => {
    await reservePort(5450, 'Test reservation');

    // Try to allocate a port - it should skip 5450
    const port = await allocatePort('test', 'postgres', 'postgres');
    expect(port).not.toBe(5450);
  });

  it('should unreserve a port', async () => {
    await reservePort(5450, 'Test reservation');
    const unreserved = await unreservePort(5450);

    expect(unreserved).toBe(true);
  });

  it('should prevent allocating reserved ports', async () => {
    // Reserve a port in the range
    await reservePort(5450, 'Reserved');

    // Allocate a port - should skip the reserved one
    const port = await allocatePort('test', 'postgres', 'postgres');
    expect(port).not.toBe(5450);
    expect(port).toBeGreaterThanOrEqual(5432);
    expect(port).toBeLessThanOrEqual(5499);
  });

  it('should get status with both allocations and reservations', async () => {
    // Allocate a port
    await allocatePort('test-project', 'postgres', 'postgres');

    // Reserve another port
    await reservePort(5450, 'Test reservation');

    const status = getStatus();

    expect(status.types.postgres).toBeDefined();
    expect(status.types.postgres.used).toBe(1); // One allocated
    expect(status.types.postgres.available).toBeLessThan(68); // Total - used (68 is range size)
    expect(status.types.postgres.next).toBeGreaterThanOrEqual(5432);
  });

  it('should throw error when reserving already allocated port', async () => {
    // First allocate a port
    const port = await allocatePort('test-project', 'postgres', 'postgres');

    // Then try to reserve the same port - should throw
    await expect(reservePort(port, 'Test reservation')).rejects.toThrow(
      `Port ${port} is already allocated to test-project/postgres`
    );
  });

  it('should throw error when reserving already reserved port', async () => {
    // First reserve a port
    await reservePort(5450, 'First reservation');

    // Then try to reserve the same port again - should throw
    await expect(reservePort(5450, 'Second reservation')).rejects.toThrow(
      'Port 5450 is already reserved: First reservation'
    );
  });

  it('should handle no available ports error', async () => {
    // Allocate ports until we run out of the range
    let allocatedPorts = 0;
    let lastError: Error | null = null;

    // Try to allocate ports until we hit the limit
    for (let i = 0; i < 100; i++) {
      // Safety limit to prevent infinite loop
      try {
        await allocatePort(`project${i}`, 'postgres', 'postgres');
        allocatedPorts++;
      } catch (error) {
        lastError = error as Error;
        break;
      }
    }

    // Should have allocated at least some ports before failing
    expect(allocatedPorts).toBeGreaterThan(0);
    expect(lastError).toBeTruthy();
    expect(lastError!.message).toMatch(/No available ports/);
  });

  it('should warn when allocating a port already in use', async () => {
    // Mock port-utils with partial mock
    vi.doMock('../src/port-utils.js', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        checkPortInUse: vi.fn().mockResolvedValue(true),
      };
    });

    // Re-import to get the mocked version
    vi.resetModules();
    const { allocatePort: mockedAllocatePort } = await import(
      '../src/port-manager.js'
    );

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const port = await mockedAllocatePort(
      'test-project',
      'postgres',
      'postgres'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `⚠️  Warning: Port ${port} is currently in use by another process`
      )
    );

    consoleSpy.mockRestore();
    vi.doUnmock('../src/port-utils.js');
    vi.resetModules();
  });

  it('should throw error when releasing port without service or --all flag', async () => {
    await expect(releasePort('test-project')).rejects.toThrow(
      'Must specify --all or provide a service name'
    );
  });

  it('should release port by number', async () => {
    // First allocate a port
    const port = await allocatePort('test-project', 'postgres', 'postgres');

    // Release by port number
    const released = await releasePortByNumber(port);
    expect(released).toBe(true);

    // Verify it's no longer allocated
    const allocations = await listAllocations();
    expect(allocations.some((a) => a.port === port)).toBe(false);
  });

  it('should return false when trying to release non-allocated port by number', async () => {
    // Try to release a port that was never allocated
    const released = await releasePortByNumber(9999);
    expect(released).toBe(false);
  });

  it('should support custom port types', async () => {
    const port = await allocatePort('test', 'custom', 'custom');
    expect(port).toBeGreaterThanOrEqual(8000);
    expect(port).toBeLessThanOrEqual(8999);
  });
});
