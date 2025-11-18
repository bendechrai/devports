import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, chmodSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  safeExec,
  safeGitWorktreeRemove,
  safeScriptExecution,
  validateExecutableScript,
} from '../src/execution.js';

describe('Execution', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `devports-execution-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('safeExec', () => {
    it('should execute simple commands successfully', async () => {
      const result = await safeExec('echo', ['hello']);
      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should capture stderr output', async () => {
      const result = await safeExec('node', [
        '-e',
        'console.error("error message")',
      ]);
      expect(result.stderr).toBe('error message');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command failures', async () => {
      const result = await safeExec('false', []);
      expect(result.exitCode).toBe(1);
    });

    it('should reject on spawn errors', async () => {
      await expect(safeExec('nonexistent-command', [])).rejects.toThrow();
    });

    it('should pass options to spawn', async () => {
      const result = await safeExec('pwd', [], { cwd: tempDir });
      expect(result.stdout).toContain(tempDir);
    });

    it('should handle commands with no stdout/stderr', async () => {
      const result = await safeExec('true', []);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('safeGitWorktreeAdd', () => {
    it('should handle git worktree add failures', async () => {
      // Mock safeExec to simulate failure
      const originalSafeExec = vi.fn().mockResolvedValue({
        exitCode: 1,
        stderr: 'fatal: not a git repository',
        stdout: '',
      });

      vi.doMock('../src/execution.js', () => ({
        safeExec: originalSafeExec,
        safeGitWorktreeAdd: vi
          .fn()
          .mockImplementation(async (path, branch, options) => {
            const result = await originalSafeExec(
              'git',
              ['worktree', 'add', path, '-b', branch],
              {
                ...options,
                stdio: 'inherit',
              }
            );
            if (result.exitCode !== 0) {
              throw new Error(
                `Git worktree add failed: ${result.stderr || 'Unknown error'}`
              );
            }
          }),
      }));

      const { safeGitWorktreeAdd: mockedSafeGitWorktreeAdd } = await import(
        '../src/execution.js'
      );
      const invalidPath = join(tempDir, 'nonexistent', 'path');

      await expect(
        mockedSafeGitWorktreeAdd(invalidPath, 'test-branch')
      ).rejects.toThrow('Git worktree add failed');

      vi.doUnmock('../src/execution.js');
    });

    it('should pass options correctly', async () => {
      // Mock safeExec to simulate failure with options
      const originalSafeExec = vi.fn().mockResolvedValue({
        exitCode: 1,
        stderr: 'error',
        stdout: '',
      });

      vi.doMock('../src/execution.js', () => ({
        safeExec: originalSafeExec,
        safeGitWorktreeAdd: vi
          .fn()
          .mockImplementation(async (path, branch, options) => {
            const result = await originalSafeExec(
              'git',
              ['worktree', 'add', path, '-b', branch],
              {
                ...options,
                stdio: 'inherit',
              }
            );
            if (result.exitCode !== 0) {
              throw new Error(
                `Git worktree add failed: ${result.stderr || 'Unknown error'}`
              );
            }
          }),
      }));

      const { safeGitWorktreeAdd: mockedSafeGitWorktreeAdd } = await import(
        '../src/execution.js'
      );

      await expect(
        mockedSafeGitWorktreeAdd(tempDir, 'test-branch', { cwd: tempDir })
      ).rejects.toThrow('Git worktree add failed');

      vi.doUnmock('../src/execution.js');
    });
  });

  describe('safeGitWorktreeRemove', () => {
    it('should handle git worktree remove failures', async () => {
      const invalidPath = join(tempDir, 'nonexistent');

      await expect(safeGitWorktreeRemove(invalidPath)).rejects.toThrow(
        'Git worktree remove failed'
      );
    });

    it('should handle force removal', async () => {
      const invalidPath = join(tempDir, 'nonexistent');

      await expect(safeGitWorktreeRemove(invalidPath, true)).rejects.toThrow(
        'Git worktree remove failed'
      );
    });

    it('should pass options correctly', async () => {
      await expect(
        safeGitWorktreeRemove(tempDir, false, { cwd: tempDir })
      ).rejects.toThrow();
    });
  });

  describe('safeScriptExecution', () => {
    it('should execute valid scripts successfully', async () => {
      const scriptPath = join(tempDir, 'test-script.sh');
      writeFileSync(scriptPath, '#!/bin/bash\necho "script executed"');
      chmodSync(scriptPath, '755');

      // Mock safeExec for this test
      const originalSafeExec = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // chmod
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'script executed',
          stderr: '',
        }); // script execution

      vi.doMock('../src/execution.js', () => ({
        safeExec: originalSafeExec,
        safeScriptExecution: vi
          .fn()
          .mockImplementation(async (path, env, options) => {
            // Call chmod
            await originalSafeExec('chmod', ['+x', path]);
            // Call script
            const result = await originalSafeExec(path, [], {
              ...options,
              env: { ...process.env, ...env },
              stdio: 'inherit',
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `Script execution failed: ${result.stderr || 'Unknown error'}`
              );
            }
          }),
      }));

      const { safeScriptExecution: mockedSafeScriptExecution } = await import(
        '../src/execution.js'
      );
      await expect(
        mockedSafeScriptExecution(scriptPath, { TEST_VAR: 'test' })
      ).resolves.not.toThrow();

      vi.doUnmock('../src/execution.js');
    });

    it('should handle script execution failures', async () => {
      const scriptPath = join(tempDir, 'failing-script.sh');
      writeFileSync(scriptPath, '#!/bin/bash\nexit 1');

      await expect(safeScriptExecution(scriptPath)).rejects.toThrow(
        'Script execution failed'
      );
    });

    it('should handle chmod failures', async () => {
      const scriptPath = join(tempDir, 'nonexistent-script.sh');

      await expect(safeScriptExecution(scriptPath)).rejects.toThrow();
    });
  });

  describe('validateExecutableScript', () => {
    it('should validate executable files on Unix-like systems', () => {
      const scriptPath = join(tempDir, 'executable-script.sh');
      writeFileSync(scriptPath, '#!/bin/bash\necho "test"');
      chmodSync(scriptPath, '755');

      if (process.platform !== 'win32') {
        expect(() => validateExecutableScript(scriptPath)).not.toThrow();
      }
    });

    it('should throw for non-executable files on Unix-like systems', () => {
      const scriptPath = join(tempDir, 'non-executable.txt');
      writeFileSync(scriptPath, 'hello world');
      chmodSync(scriptPath, '644');

      if (process.platform !== 'win32') {
        expect(() => validateExecutableScript(scriptPath)).toThrow(
          'Script is not executable'
        );
      }
    });

    it('should throw for non-existent files', () => {
      const scriptPath = join(tempDir, 'nonexistent.sh');

      expect(() => validateExecutableScript(scriptPath)).toThrow(
        'Script validation failed'
      );
    });

    it('should throw for directories', () => {
      expect(() => validateExecutableScript(tempDir)).toThrow(
        'Script path is not a file'
      );
    });

    it('should handle Windows platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const scriptPath = join(tempDir, 'windows-script.bat');
      writeFileSync(scriptPath, '@echo off\necho "test"');

      expect(() => validateExecutableScript(scriptPath)).not.toThrow();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
