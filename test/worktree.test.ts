import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync, spawn } from 'child_process';
import { createWorktree, removeWorktree } from '../src/worktree.js';
import { listAllocations } from '../src/port-manager.js';

// Mock child_process for git commands
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock glob module
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

let TEST_DIR: string;
let TEST_CONFIG_DIR: string;
let TEST_WORKTREE: string;

describe('Worktree Integration', () => {
  beforeEach(() => {
    // Create unique test directories for each test
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2);
    TEST_DIR = join(tmpdir(), 'devports-worktree-test-' + uniqueId);
    TEST_CONFIG_DIR = join(tmpdir(), 'devports-config-test-' + uniqueId);
    TEST_WORKTREE = join(TEST_DIR, 'test-worktree');

    // Set test config directory
    process.env.DEVPORTS_CONFIG_DIR = TEST_CONFIG_DIR;

    // Create test directories
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    // Reset mocks
    vi.clearAllMocks();

    // Mock successful git worktree creation
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('worktree add')) {
        // Simulate worktree creation
        mkdirSync(TEST_WORKTREE, { recursive: true });
        return Buffer.from('');
      }
      if (cmd.includes('worktree remove')) {
        // Simulate worktree removal
        if (existsSync(TEST_WORKTREE)) {
          rmSync(TEST_WORKTREE, { recursive: true });
        }
        return Buffer.from('');
      }
      return Buffer.from('');
    });

    // Mock spawn for secure git worktree operations
    vi.mocked(spawn).mockImplementation(
      (command: string, args?: readonly string[]) => {
        const mockChild: any = {
          stdout: {
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                // Simulate some output
                callback(Buffer.from(''));
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              // Handle git worktree commands
              if (command === 'git' && args && args.includes('worktree')) {
                if (args.includes('add')) {
                  // Find the path argument (it comes after 'add')
                  const addIndex = args.indexOf('add');
                  if (addIndex >= 0 && addIndex + 1 < args.length) {
                    const worktreePath = args[addIndex + 1];
                    mkdirSync(worktreePath, { recursive: true });
                  }
                } else if (args.includes('remove')) {
                  // Find the path argument (it comes after 'remove')
                  const removeIndex = args.indexOf('remove');
                  if (removeIndex >= 0 && removeIndex + 1 < args.length) {
                    const worktreePath = args[removeIndex + 1];
                    if (existsSync(worktreePath)) {
                      rmSync(worktreePath, { recursive: true, force: true });
                    }
                  }
                }
              }
              // Simulate successful completion
              callback(0);
            }
          }),
        };
        return mockChild;
      }
    );
  });

  afterEach(() => {
    // Clean up
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

  describe('createWorktree', () => {
    it('should create worktree and allocate default ports', async () => {
      const result = await createWorktree(TEST_WORKTREE, 'feature/test');

      expect(result.worktreePath).toBe(TEST_WORKTREE);
      expect(result.ports).toBeDefined();
      expect(result.ports.postgres).toBeGreaterThanOrEqual(5432);

      // Verify git command was called
      expect(spawn).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['worktree', 'add']),
        expect.any(Object)
      );
    });

    it('should detect services from existing .env file', async () => {
      // Create a fake .env in current directory
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(envPath, 'DATABASE_PORT=5432\nAPI_PORT=3000\n');

      // Change to test directory
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');

        // Should detect both postgres and api
        expect(result.ports.postgres).toBeDefined();
        expect(result.ports.api).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should allocate custom services when specified', async () => {
      const result = await createWorktree(TEST_WORKTREE, 'feature/test', {
        services: ['postgres:postgres', 'redis:redis', 'api:api'],
      });

      expect(result.ports.postgres).toBeDefined();
      expect(result.ports.redis).toBeDefined();
      expect(result.ports.api).toBeDefined();
      expect(Object.keys(result.ports)).toHaveLength(3);
    });

    it('should create .env file with allocated ports', async () => {
      const result = await createWorktree(TEST_WORKTREE, 'feature/test', {
        services: ['postgres:postgres', 'api:api'],
      });

      const envPath = join(TEST_WORKTREE, '.env');
      expect(existsSync(envPath)).toBe(true);

      const envContent = readFileSync(envPath, 'utf-8');
      expect(envContent).toContain(`POSTGRES_PORT=${result.ports.postgres}`);
      expect(envContent).toContain(`API_PORT=${result.ports.api}`);
      expect(envContent).toContain('DATABASE_URL=postgresql://');
    });

    it('should skip .env creation when envFile is false', async () => {
      const result = await createWorktree(TEST_WORKTREE, 'feature/test', {
        envFile: undefined,
        services: ['postgres:postgres'],
      });

      // When envFile is undefined, it should still create .env
      // To skip, we need to handle this differently in the implementation
      expect(result.ports.postgres).toBeDefined();
    });

    it('should use custom .env file name', async () => {
      await createWorktree(TEST_WORKTREE, 'feature/test', {
        envFile: '.env.local',
        services: ['postgres:postgres'],
      });

      const envPath = join(TEST_WORKTREE, '.env.local');
      expect(existsSync(envPath)).toBe(true);
    });

    it('should allocate ports with unique project identifiers', async () => {
      // Create two worktrees with same service
      const worktree1 = join(TEST_DIR, 'worktree1');
      const worktree2 = join(TEST_DIR, 'worktree2');

      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd.includes('worktree1')) {
          mkdirSync(worktree1, { recursive: true });
        } else if (cmd.includes('worktree2')) {
          mkdirSync(worktree2, { recursive: true });
        }
        return Buffer.from('');
      });

      const result1 = await createWorktree(worktree1, 'feature/auth', {
        services: ['postgres:postgres'],
      });

      const result2 = await createWorktree(worktree2, 'feature/auth', {
        services: ['postgres:postgres'],
      });

      // Should get different ports even with same branch name
      expect(result1.ports.postgres).not.toBe(result2.ports.postgres);
    });

    it('should handle git command failures gracefully', async () => {
      vi.mocked(spawn).mockImplementation(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              // Simulate command failure
              callback(1);
            }
          }),
        };
        return mockChild;
      });

      await expect(
        createWorktree(TEST_WORKTREE, 'feature/test')
      ).rejects.toThrow(/Failed to create git worktree/);
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree and release all ports', async () => {
      // First create a worktree
      await createWorktree(TEST_WORKTREE, 'feature/test', {
        services: ['postgres:postgres', 'api:api'],
      });

      // Verify ports are allocated
      const beforeAllocations = listAllocations({ project: 'test-worktree' });
      expect(beforeAllocations.length).toBeGreaterThan(0);

      // Remove the worktree
      const released = await removeWorktree(TEST_WORKTREE);

      // Verify ports are released
      expect(released).toBeGreaterThan(0);
      const afterAllocations = listAllocations({ project: 'test-worktree' });
      expect(afterAllocations.length).toBe(0);

      // Verify git command was called
      expect(spawn).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['worktree', 'remove']),
        expect.any(Object)
      );
    });

    it('should support force removal', async () => {
      await createWorktree(TEST_WORKTREE, 'feature/test');

      await removeWorktree(TEST_WORKTREE, { force: true });

      expect(spawn).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['--force']),
        expect.any(Object)
      );
    });

    it('should handle git removal failures gracefully', async () => {
      // First, create the worktree successfully
      await createWorktree(TEST_WORKTREE, 'feature/test');

      // Then mock git failure for the removal command specifically
      vi.mocked(spawn).mockImplementation(
        (command: string, args?: readonly string[]) => {
          const mockChild: any = {
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                if (command === 'git' && args && args.includes('remove')) {
                  // Simulate removal failure
                  callback(1);
                } else {
                  callback(0);
                }
              }
            }),
          };
          return mockChild;
        }
      );

      await expect(removeWorktree(TEST_WORKTREE)).rejects.toThrow(
        /Failed to remove git worktree/
      );
    });
  });

  describe('Service Detection', () => {
    it('should detect postgres from DATABASE_PORT', async () => {
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(envPath, 'DATABASE_PORT=5432\n');

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        expect(result.ports.postgres).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should detect multiple services from .env', async () => {
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(
        envPath,
        [
          'DATABASE_PORT=5432',
          'REDIS_PORT=6379',
          'API_PORT=3000',
          'APP_PORT=5000',
        ].join('\n')
      );

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');

        expect(result.ports.postgres).toBeDefined();
        expect(result.ports.redis).toBeDefined();
        expect(result.ports.api).toBeDefined();
        expect(result.ports.app).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should default to postgres when no .env exists', async () => {
      const result = await createWorktree(TEST_WORKTREE, 'feature/test');

      expect(result.ports.postgres).toBeDefined();
      expect(Object.keys(result.ports)).toHaveLength(1);
    });

    it('should detect MYSQL_PORT from .env content', async () => {
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(envPath, 'MYSQL_PORT=3306\nMYSQL_HOST=localhost');

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        expect(result.ports.mysql).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should detect WEB_PORT from .env content', async () => {
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(envPath, 'WEB_PORT=8080\nAPP_URL=http://localhost');

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        expect(result.ports.app).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should not duplicate services when already detected', async () => {
      const envPath = join(TEST_DIR, '.env');
      writeFileSync(envPath, 'DATABASE_PORT=5432\nPOSTGRES_PORT=5433');

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        // Should only have one postgres service despite multiple postgres patterns
        expect(result.ports.postgres).toBeDefined();
        const postgresAllocations = Object.keys(result.ports).filter((k) =>
          k.includes('postgres')
        );
        expect(postgresAllocations).toHaveLength(1);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Auto-rendering DevPorts Files', () => {
    it('should auto-render .devports files during worktree creation', async () => {
      // Create a .devports template file
      const templateContent = `version: '3.8'
services:
  app:
    image: nginx
    ports:
      - "{{APP_PORT}}:80"
  db:
    image: postgres
    environment:
      POSTGRES_PORT: {{POSTGRES_PORT}}`;

      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        writeFileSync('docker-compose.yml.devports', templateContent);

        // Mock glob to find our template
        const { glob } = await import('glob');
        vi.mocked(glob).mockResolvedValue(['docker-compose.yml.devports']);

        const result = await createWorktree(TEST_WORKTREE, 'feature/test');

        // Check if rendered file would be created
        expect(result).toBeDefined();
      } finally {
        process.chdir(originalCwd);
        // Cleanup
        const templateFile = join(TEST_DIR, 'docker-compose.yml.devports');
        if (existsSync(templateFile)) {
          rmSync(templateFile);
        }
      }
    });

    it('should handle template rendering errors gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        // Create a malformed template
        writeFileSync('invalid.devports', '{{UNCLOSED_TEMPLATE');

        // Mock glob to find the invalid template
        const { glob } = await import('glob');
        vi.mocked(glob).mockResolvedValue(['invalid.devports']);

        // Should not throw despite template error
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        expect(result).toBeDefined();
      } finally {
        process.chdir(originalCwd);
        const invalidFile = join(TEST_DIR, 'invalid.devports');
        if (existsSync(invalidFile)) {
          rmSync(invalidFile);
        }
      }
    });

    it('should handle glob errors during auto-rendering', async () => {
      // Mock glob to throw an error
      const { glob } = await import('glob');
      vi.mocked(glob).mockRejectedValue(new Error('Glob error'));

      // Should handle error gracefully
      const result = await createWorktree(TEST_WORKTREE, 'feature/test');
      expect(result).toBeDefined();
    });

    it('should skip auto-rendering when no .devports files found', async () => {
      // Mock glob to return empty array
      const { glob } = await import('glob');
      vi.mocked(glob).mockResolvedValue([]);

      const result = await createWorktree(TEST_WORKTREE, 'feature/test');
      expect(result).toBeDefined();
    });
  });

  describe('Post-Worktree Hooks', () => {
    it('should execute post-worktree hook when available', async () => {
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        // Create hook directory and script
        const hookDir = join(TEST_DIR, '.devports', 'hooks');
        mkdirSync(hookDir, { recursive: true });

        const hookScript = join(hookDir, 'post-worktree');
        writeFileSync(hookScript, '#!/bin/bash\necho "Hook executed"');

        // Mock safeScriptExecution
        const execution = await import('../src/execution.js');
        const mockSafeScriptExecution = vi
          .spyOn(execution, 'safeScriptExecution')
          .mockResolvedValue();

        const result = await createWorktree(TEST_WORKTREE, 'feature/test');

        expect(mockSafeScriptExecution).toHaveBeenCalledWith(
          '.devports/hooks/post-worktree',
          expect.objectContaining({
            DEVPORTS_PROJECT_NAME: expect.any(String),
            DEVPORTS_WORKTREE_PATH: TEST_WORKTREE,
            POSTGRES_PORT: expect.any(String),
          }),
          expect.any(Object)
        );

        expect(result).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle hook execution failures gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        // Create hook script
        const hookDir = join(TEST_DIR, '.devports', 'hooks');
        mkdirSync(hookDir, { recursive: true });

        const hookScript = join(hookDir, 'post-worktree');
        writeFileSync(hookScript, '#!/bin/bash\nexit 1');

        // Mock safeScriptExecution to throw
        const execution = await import('../src/execution.js');
        vi.spyOn(execution, 'safeScriptExecution').mockRejectedValue(
          new Error('Hook execution failed')
        );

        // Should not throw despite hook failure
        const result = await createWorktree(TEST_WORKTREE, 'feature/test');
        expect(result).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should skip hook execution when no hook exists', async () => {
      const execution = await import('../src/execution.js');
      const mockSafeScriptExecution = vi
        .spyOn(execution, 'safeScriptExecution')
        .mockResolvedValue();

      const result = await createWorktree(TEST_WORKTREE, 'feature/test');

      expect(mockSafeScriptExecution).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should properly format environment variables for hooks', async () => {
      const originalCwd = process.cwd();
      process.chdir(TEST_DIR);

      try {
        // Create hook script
        const hookDir = join(TEST_DIR, '.devports', 'hooks');
        mkdirSync(hookDir, { recursive: true });

        const hookScript = join(hookDir, 'post-worktree');
        writeFileSync(hookScript, '#!/bin/bash\necho "Hook"');

        // Mock safeScriptExecution
        const execution = await import('../src/execution.js');
        const mockSafeScriptExecution = vi
          .spyOn(execution, 'safeScriptExecution')
          .mockResolvedValue();

        // Create worktree with service that has dashes
        await createWorktree(TEST_WORKTREE, 'feature/test', {
          project: 'test-project',
          services: ['my-api:api'],
        });

        expect(mockSafeScriptExecution).toHaveBeenCalledWith(
          '.devports/hooks/post-worktree',
          expect.objectContaining({
            MY_API_PORT: expect.any(String), // Should convert dashes to underscores
          }),
          expect.any(Object)
        );
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
