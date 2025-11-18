import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LockManager', () => {
  let tempDir: string;
  let mockRegistry: any;
  let mockLockRelease: any;
  let mockLock: any;
  let mockLoadConfig: any;
  let mockLoadRegistry: any;
  let mockSaveRegistry: any;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `devports-lock-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    mkdirSync(tempDir, { recursive: true });

    mockRegistry = {
      allocations: [],
      reservations: [],
    };

    mockLockRelease = vi.fn();
    mockLock = vi.fn().mockResolvedValue(mockLockRelease);
    mockLoadConfig = vi.fn();
    mockLoadRegistry = vi.fn();
    mockSaveRegistry = vi.fn();

    // Setup default mocks
    mockLoadConfig.mockReturnValue({
      registryPath: join(tempDir, 'registry.json'),
    });
    mockLoadRegistry.mockReturnValue(mockRegistry);
    mockSaveRegistry.mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('withRegistryLock', () => {
    it('should execute operation with lock and save registry', async () => {
      // Mock modules before importing
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockReturnValue('test-result');
      const result = await LockManager.withRegistryLock(operation);

      expect(result).toBe('test-result');
      expect(mockLoadRegistry).toHaveBeenCalledTimes(2);
      expect(operation).toHaveBeenCalledWith(mockRegistry);
      expect(mockSaveRegistry).toHaveBeenCalledWith(mockRegistry);
      expect(mockLockRelease).toHaveBeenCalled();

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });

    it('should handle async operations', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockResolvedValue('async-result');
      const result = await LockManager.withRegistryLock(operation);

      expect(result).toBe('async-result');
      expect(operation).toHaveBeenCalledWith(mockRegistry);

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });

    it('should release lock even if operation throws', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockRejectedValue(new Error('operation error'));
      await expect(LockManager.withRegistryLock(operation)).rejects.toThrow(
        'operation error'
      );
      expect(mockLockRelease).toHaveBeenCalled();

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });
  });

  describe('withRegistryLockConditional', () => {
    it('should save registry when shouldSave is not false', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockReturnValue({
        result: 'test-result',
        shouldSave: true,
      });

      const result = await LockManager.withRegistryLockConditional(operation);

      expect(result).toBe('test-result');
      expect(mockSaveRegistry).toHaveBeenCalledWith(mockRegistry);

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });

    it('should not save registry when shouldSave is false', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockReturnValue({
        result: 'test-result',
        shouldSave: false,
      });

      const result = await LockManager.withRegistryLockConditional(operation);

      expect(result).toBe('test-result');
      expect(mockSaveRegistry).not.toHaveBeenCalled();

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });
  });

  describe('withRegistryReadLock', () => {
    it('should execute read-only operation without saving', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const operation = vi.fn().mockReturnValue('read-result');
      const result = await LockManager.withRegistryReadLock(operation);

      expect(result).toBe('read-result');
      expect(operation).toHaveBeenCalledWith(mockRegistry);
      expect(mockSaveRegistry).not.toHaveBeenCalled();

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });
  });

  describe('withFileLock', () => {
    it('should execute operation with custom file lock', async () => {
      vi.doMock('proper-lockfile', () => ({
        default: { lock: mockLock },
      }));
      vi.doMock('../src/config.js', () => ({
        loadConfig: mockLoadConfig,
        loadRegistry: mockLoadRegistry,
        saveRegistry: mockSaveRegistry,
      }));

      const { LockManager } = await import('../src/services/lock-manager.js');

      const filePath = join(tempDir, 'custom-file.txt');
      const operation = vi.fn().mockReturnValue('file-result');

      const result = await LockManager.withFileLock(filePath, operation);

      expect(result).toBe('file-result');
      expect(operation).toHaveBeenCalled();
      expect(mockLockRelease).toHaveBeenCalled();
      expect(mockLock).toHaveBeenCalledWith(
        filePath,
        expect.objectContaining({ retries: 5, stale: 10000 })
      );

      vi.doUnmock('proper-lockfile');
      vi.doUnmock('../src/config.js');
    });
  });
});
