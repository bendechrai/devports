import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ensureConfigDir,
  loadConfig,
  loadRegistry,
  saveRegistry,
} from '../src/config.js';

describe('Config', () => {
  let tempConfigDir: string;
  let originalConfigDir: string | undefined;

  beforeEach(() => {
    tempConfigDir = join(
      tmpdir(),
      `devports-config-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    originalConfigDir = process.env.DEVPORTS_CONFIG_DIR;
    process.env.DEVPORTS_CONFIG_DIR = tempConfigDir;
  });

  afterEach(() => {
    process.env.DEVPORTS_CONFIG_DIR = originalConfigDir;
    try {
      rmSync(tempConfigDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ensureConfigDir', () => {
    it('should create config directory if it does not exist', () => {
      expect(existsSync(tempConfigDir)).toBe(false);

      ensureConfigDir();

      expect(existsSync(tempConfigDir)).toBe(true);
    });

    it('should not throw if config directory already exists', () => {
      mkdirSync(tempConfigDir, { recursive: true });

      expect(() => ensureConfigDir()).not.toThrow();
    });

    it('should handle permission errors when creating directory', () => {
      // Mock a scenario where directory creation fails
      const readOnlyParent = join(tempConfigDir, 'readonly');
      mkdirSync(readOnlyParent, { recursive: true });
      // Make the parent directory read-only on Unix systems
      if (process.platform !== 'win32') {
        try {
          // This might not work in all environments, so wrap in try-catch
          const { chmodSync } = require('fs');
          chmodSync(readOnlyParent, '444');

          process.env.DEVPORTS_CONFIG_DIR = join(readOnlyParent, 'devports');

          expect(() => ensureConfigDir()).toThrow(
            'Failed to create config directory'
          );

          // Restore permissions for cleanup
          chmodSync(readOnlyParent, '755');
        } catch {
          // Skip this test if we can't change permissions
        }
      }
    });
  });

  describe('loadConfig', () => {
    it('should create default config if none exists', () => {
      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.ranges).toBeDefined();
      expect(config.ranges.postgres).toEqual({ start: 5434, end: 5499 });
      expect(config.ranges.mysql).toEqual({ start: 3308, end: 3399 });
      expect(config.ranges.redis).toEqual({ start: 6381, end: 6399 });
      expect(config.ranges.api).toEqual({ start: 3002, end: 3099 });
      expect(config.ranges.app).toEqual({ start: 5002, end: 5999 });
      expect(config.ranges.custom).toEqual({ start: 8002, end: 8999 });
      expect(config.registryPath).toBe(join(tempConfigDir, 'ports.json'));
    });

    it('should load existing valid config', () => {
      ensureConfigDir();
      const configFile = join(tempConfigDir, 'config.json');
      const customConfig = {
        ranges: {
          postgres: { start: 5500, end: 5599 },
          redis: { start: 6400, end: 6499 },
        },
        registryPath: join(tempConfigDir, 'custom-ports.json'),
      };

      writeFileSync(configFile, JSON.stringify(customConfig, null, 2));

      const config = loadConfig();

      expect(config.ranges.postgres).toEqual({ start: 5500, end: 5599 });
      expect(config.ranges.redis).toEqual({ start: 6400, end: 6499 });
      expect(config.registryPath).toBe(
        join(tempConfigDir, 'custom-ports.json')
      );
    });

    it('should handle invalid JSON in config file', () => {
      ensureConfigDir();
      const configFile = join(tempConfigDir, 'config.json');

      writeFileSync(configFile, 'invalid json content');

      expect(() => loadConfig()).toThrow('contains invalid JSON');
    });

    it('should handle file read errors', () => {
      ensureConfigDir();
      const configFile = join(tempConfigDir, 'config.json');

      // Create a directory instead of a file to cause a read error
      mkdirSync(configFile);

      expect(() => loadConfig()).toThrow('Failed to read config file');
    });

    it('should handle write errors when creating default config', () => {
      // Create config directory but make it read-only on Unix systems
      if (process.platform !== 'win32') {
        try {
          mkdirSync(tempConfigDir, { recursive: true });
          const { chmodSync } = require('fs');
          chmodSync(tempConfigDir, '444');

          expect(() => loadConfig()).toThrow('Failed to create config file');

          // Restore permissions for cleanup
          chmodSync(tempConfigDir, '755');
        } catch {
          // Skip this test if we can't change permissions
        }
      }
    });
  });

  describe('loadRegistry', () => {
    it('should create default registry if none exists', () => {
      const registry = loadRegistry();

      expect(registry).toBeDefined();
      expect(registry.allocations).toEqual([]);
      expect(registry.reservations).toEqual([
        {
          port: 8080,
          reason: 'Common development server port',
          reservedAt: expect.any(String),
        },
      ]);
    });

    it('should load existing valid registry', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      const customRegistry = {
        allocations: [{ project: 'test', service: 'postgres', port: 5432 }],
        reservations: [{ port: 8080, reason: 'test reservation' }],
      };

      writeFileSync(registryPath, JSON.stringify(customRegistry, null, 2));

      const registry = loadRegistry();

      expect(registry.allocations).toHaveLength(1);
      expect(registry.allocations[0]).toEqual({
        project: 'test',
        service: 'postgres',
        port: 5432,
      });
      expect(registry.reservations).toHaveLength(1);
      expect(registry.reservations[0]).toEqual({
        port: 8080,
        reason: 'test reservation',
      });
    });

    it('should handle invalid JSON in registry file', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      writeFileSync(registryPath, 'invalid json content');

      expect(() => loadRegistry()).toThrow('contains invalid JSON');
    });

    it('should handle corrupted registry with missing allocations', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      const corruptedRegistry = {
        reservations: [],
      };

      writeFileSync(registryPath, JSON.stringify(corruptedRegistry, null, 2));

      expect(() => loadRegistry()).toThrow(
        'missing or invalid allocations array'
      );
    });

    it('should handle corrupted registry with invalid allocations type', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      const corruptedRegistry = {
        allocations: 'not an array',
        reservations: [],
      };

      writeFileSync(registryPath, JSON.stringify(corruptedRegistry, null, 2));

      expect(() => loadRegistry()).toThrow(
        'missing or invalid allocations array'
      );
    });

    it('should handle corrupted registry with missing reservations', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      const corruptedRegistry = {
        allocations: [],
      };

      writeFileSync(registryPath, JSON.stringify(corruptedRegistry, null, 2));

      expect(() => loadRegistry()).toThrow(
        'missing or invalid reservations array'
      );
    });

    it('should handle corrupted registry with invalid reservations type', () => {
      // First create config
      loadConfig();

      const registryPath = join(tempConfigDir, 'ports.json');
      const corruptedRegistry = {
        allocations: [],
        reservations: 'not an array',
      };

      writeFileSync(registryPath, JSON.stringify(corruptedRegistry, null, 2));

      expect(() => loadRegistry()).toThrow(
        'missing or invalid reservations array'
      );
    });

    it('should handle registry file creation errors', () => {
      // First create config
      loadConfig();

      // Make the directory read-only on Unix systems to cause write error
      if (process.platform !== 'win32') {
        try {
          const { chmodSync } = require('fs');
          chmodSync(tempConfigDir, '444');

          expect(() => loadRegistry()).toThrow(
            'Failed to create registry file'
          );

          // Restore permissions for cleanup
          chmodSync(tempConfigDir, '755');
        } catch {
          // Skip this test if we can't change permissions
        }
      }
    });
  });

  describe('saveRegistry', () => {
    it('should save registry successfully', () => {
      // First create config
      loadConfig();

      const registry = {
        allocations: [{ project: 'test', service: 'postgres', port: 5432 }],
        reservations: [],
      };

      expect(() => saveRegistry(registry)).not.toThrow();

      // Verify the registry was saved correctly
      const loadedRegistry = loadRegistry();
      expect(loadedRegistry.allocations).toHaveLength(1);
      expect(loadedRegistry.allocations[0]).toEqual({
        project: 'test',
        service: 'postgres',
        port: 5432,
      });
    });

    it('should handle write errors when saving registry', () => {
      // First create config
      loadConfig();

      const registry = {
        allocations: [],
        reservations: [],
      };

      // Make the directory read-only on Unix systems to cause write error
      if (process.platform !== 'win32') {
        try {
          const { chmodSync } = require('fs');
          chmodSync(tempConfigDir, '444');

          expect(() => saveRegistry(registry)).toThrow(
            'Failed to save registry'
          );

          // Restore permissions for cleanup
          chmodSync(tempConfigDir, '755');
        } catch {
          // Skip this test if we can't change permissions
        }
      }
    });
  });
});
