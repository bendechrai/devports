import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setupCurrentDirectory } from '../src/setup.js';

let TEST_DIR: string;
let TEST_CONFIG_DIR: string;

// Mock process.cwd() to return our test directory
const originalCwd = process.cwd;
const originalExit = process.exit;

describe('Setup Command', () => {
  beforeEach(() => {
    // Create unique test directories for each test
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2);
    TEST_DIR = join(tmpdir(), 'devports-setup-test-' + uniqueId);
    TEST_CONFIG_DIR = join(tmpdir(), 'devports-config-setup-test-' + uniqueId);

    // Create unique test directories
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });

    // Set test config directory
    process.env.DEVPORTS_CONFIG_DIR = TEST_CONFIG_DIR;

    // Mock process.cwd() to return test directory
    process.cwd = vi.fn(() => TEST_DIR);

    // Mock process.exit to avoid actually exiting
    process.exit = vi.fn() as any;

    // Create .git directory to simulate main clone
    const gitDir = join(TEST_DIR, '.git');
    if (!existsSync(gitDir)) {
      mkdirSync(gitDir);
    }
  });

  afterEach(() => {
    // Restore original functions
    process.cwd = originalCwd;
    process.exit = originalExit;

    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }

    // Reset environment variable
    delete process.env.DEVPORTS_CONFIG_DIR;

    vi.restoreAllMocks();
  });

  describe('Safety Checks', () => {
    it('should reject setup in worktree (when .git is a file)', async () => {
      // Remove .git directory and create .git file (simulating worktree)
      rmSync(join(TEST_DIR, '.git'), { recursive: true });
      writeFileSync(
        join(TEST_DIR, '.git'),
        'gitdir: /some/path/.git/worktrees/test'
      );

      await expect(setupCurrentDirectory()).rejects.toThrow(
        'Setup can only be run in the main repository clone'
      );
    });

    it('should work in main clone (when .git is a directory)', async () => {
      // Create basic template
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}'
      );

      const result = await setupCurrentDirectory();
      expect(result.projectName).toBe('test');
    });

    it('should reject if .env exists without --force', async () => {
      writeFileSync(join(TEST_DIR, '.env'), 'existing content');
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}'
      );

      await expect(setupCurrentDirectory()).rejects.toThrow(
        '.env file already exists. Use --force to overwrite'
      );
    });

    it('should backup existing .env when using --force', async () => {
      const existingContent = 'existing env content';
      writeFileSync(join(TEST_DIR, '.env'), existingContent);
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}'
      );

      await setupCurrentDirectory({ force: true });

      expect(existsSync(join(TEST_DIR, '.env.backup'))).toBe(true);
      expect(readFileSync(join(TEST_DIR, '.env.backup'), 'utf-8')).toBe(
        existingContent
      );
    });
  });

  describe('Template Processing', () => {
    it('should process .env.devports template correctly', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=myproject\nDATABASE_URL=postgresql://user@localhost:{devports:postgres:db}/myapp\nAPI_URL=http://localhost:{devports:api:server}'
      );

      const result = await setupCurrentDirectory();

      expect(result.projectName).toBe('myproject');
      expect(result.allocatedPorts.db).toBeDefined();
      expect(result.allocatedPorts.server).toBeDefined();

      const envContent = readFileSync(join(TEST_DIR, '.env'), 'utf-8');
      expect(envContent).toContain('DEVPORTS_PROJECT_NAME=myproject');
      expect(envContent).toContain(
        `DATABASE_URL=postgresql://user@localhost:${result.allocatedPorts.db}/myapp`
      );
      expect(envContent).toContain(
        `API_URL=http://localhost:${result.allocatedPorts.server}`
      );
    });

    it('should use custom template file', async () => {
      writeFileSync(
        join(TEST_DIR, 'custom.devports'),
        'DEVPORTS_PROJECT_NAME=custom\nPORT={devports:postgres:db}'
      );

      const result = await setupCurrentDirectory({
        template: 'custom.devports',
      });

      expect(result.projectName).toBe('custom');
      expect(existsSync(join(TEST_DIR, '.env'))).toBe(true);
    });

    it('should use directory name if no project name in template', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DATABASE_PORT={devports:postgres:db}'
      );

      const result = await setupCurrentDirectory();

      // Should use the base name of TEST_DIR
      expect(result.projectName).toContain('devports-setup-test-');
    });

    it('should use directory name when DEVPORTS_PROJECT_NAME has {devports:project} placeholder', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME={devports:project}\nDATABASE_PORT={devports:postgres:db}'
      );

      const result = await setupCurrentDirectory();

      // Should use the base name of TEST_DIR, not the placeholder
      expect(result.projectName).toContain('devports-setup-test-');
      expect(result.projectName).not.toBe('devports-project');
      expect(result.projectName).not.toBe('{devports:project}');

      // Check that the .env file has the directory name, not the placeholder
      const envContent = readFileSync(join(TEST_DIR, '.env'), 'utf-8');
      expect(envContent).toContain(
        `DEVPORTS_PROJECT_NAME=${result.projectName}`
      );
      expect(envContent).not.toContain(
        'DEVPORTS_PROJECT_NAME={devports:project}'
      );
      expect(envContent).not.toContain(
        'DEVPORTS_PROJECT_NAME=devports-project'
      );
    });

    it('should override services when specified', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}'
      );

      const result = await setupCurrentDirectory({
        services: ['redis:redis', 'api:api'],
      });

      expect(result.allocatedPorts.redis).toBeDefined();
      expect(result.allocatedPorts.api).toBeDefined();
      expect(result.allocatedPorts.db).toBeUndefined();
    });
  });

  describe('Auto-rendering', () => {
    it('should auto-render *.devports files', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test-render\nDATABASE_PORT={devports:postgres:db}'
      );

      writeFileSync(
        join(TEST_DIR, 'docker-compose.yml.devports'),
        'services:\n  db:\n    ports:\n      - "{devports:postgres:db}:5432"\n    container_name: {devports:project}-db'
      );

      const result = await setupCurrentDirectory();

      expect(result.renderedFiles).toContain('docker-compose.yml');
      expect(existsSync(join(TEST_DIR, 'docker-compose.yml'))).toBe(true);

      const dockerContent = readFileSync(
        join(TEST_DIR, 'docker-compose.yml'),
        'utf-8'
      );
      expect(dockerContent).toContain(`${result.allocatedPorts.db}:5432`);
      expect(dockerContent).toContain('test-render-db');
    });

    it('should skip auto-rendering when --skip-render is true', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}'
      );

      writeFileSync(
        join(TEST_DIR, 'config.yml.devports'),
        'port: {devports:postgres:db}'
      );

      const result = await setupCurrentDirectory({ skipRender: true });

      expect(result.renderedFiles).toHaveLength(0);
      expect(existsSync(join(TEST_DIR, 'config.yml'))).toBe(false);
    });

    it('should handle multiple *.devports files', async () => {
      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=test\nDATABASE_PORT={devports:postgres:db}\nAPI_PORT={devports:api:server}'
      );

      writeFileSync(
        join(TEST_DIR, 'docker-compose.yml.devports'),
        'version: "3"\nservices:\n  db:\n    ports: ["{devports:postgres:db}:5432"]'
      );

      writeFileSync(
        join(TEST_DIR, 'nginx.conf.devports'),
        'upstream api {\n  server localhost:{devports:api:server};\n}'
      );

      const result = await setupCurrentDirectory();

      expect(result.renderedFiles).toHaveLength(2);
      expect(result.renderedFiles).toContain('docker-compose.yml');
      expect(result.renderedFiles).toContain('nginx.conf');
    });
  });

  describe('Default Service Detection', () => {
    it('should default to postgres when no template or services provided', async () => {
      const result = await setupCurrentDirectory();

      expect(result.allocatedPorts.postgres).toBeDefined();
      expect(Object.keys(result.allocatedPorts)).toHaveLength(1);
    });

    it('should detect services from existing .env file', async () => {
      writeFileSync(
        join(TEST_DIR, '.env'),
        'DATABASE_PORT=5432\nAPI_PORT=3000\nREDIS_PORT=6379'
      );

      const result = await setupCurrentDirectory({ force: true });

      expect(result.allocatedPorts.postgres).toBeDefined();
      expect(result.allocatedPorts.api).toBeDefined();
      expect(result.allocatedPorts.redis).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template files gracefully', async () => {
      // Create .git directory but no template
      writeFileSync(
        join(TEST_DIR, 'invalid.devports'),
        '{invalid template content'
      );

      const result = await setupCurrentDirectory({
        template: 'invalid.devports',
      });

      // Should fall back to default behavior
      expect(result.allocatedPorts.postgres).toBeDefined();
    });

    it('should work without any template file', async () => {
      const result = await setupCurrentDirectory();

      expect(result.projectName).toBeDefined();
      expect(result.allocatedPorts.postgres).toBeDefined();
      expect(existsSync(join(TEST_DIR, '.env'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle auto-rendering errors gracefully', async () => {
      // Create an invalid .devports file (unreadable)
      const invalidFile = join(TEST_DIR, 'invalid.devports');
      writeFileSync(invalidFile, 'test content');

      // Mock fs.readFileSync to throw an error for this specific file
      const originalReadFileSync = require('fs').readFileSync;
      vi.doMock('fs', () => ({
        ...require('fs'),
        readFileSync: vi.fn().mockImplementation((path, options) => {
          if (path.includes('invalid.devports')) {
            throw new Error('Simulated read error');
          }
          return originalReadFileSync(path, options);
        }),
      }));

      writeFileSync(
        join(TEST_DIR, '.env.devports'),
        'DEVPORTS_PROJECT_NAME=error-test\nDB_PORT={devports:postgres:db}'
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Re-import to get mocked version
      vi.resetModules();
      const { setupCurrentDirectory: mockedSetup } = await import(
        '../src/setup.js'
      );
      await mockedSetup();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Failed to render')
      );

      consoleSpy.mockRestore();
      vi.doUnmock('fs');
      vi.resetModules();
    });
  });
});
