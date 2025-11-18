import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateCompletionScript,
  isCompletionInstalled,
  getProjectsForCompletion,
  getServicesForCompletion,
} from '../src/completion/index.js';
import * as portManager from '../src/port-manager.js';

// Mock the port manager to avoid file system operations
vi.mock('../src/port-manager.js', () => ({
  listAllocations: vi.fn(),
}));

describe('Completion', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'devports-completion-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  describe('generateCompletionScript', () => {
    it('should generate zsh completion script', () => {
      const script = generateCompletionScript('zsh');

      expect(script).toContain('#compdef devports');
      expect(script).toContain('_devports()');
      expect(script).toContain(
        'compadd allocate release list status check reserve unreserve info render gitignore setup worktree completion'
      );
      expect(script).toContain('devports list --completion types');
      expect(script).toContain('devports list --completion projects');
      expect(script).toContain('_arguments');
    });

    it('should generate bash completion script', () => {
      const script = generateCompletionScript('bash');

      expect(script).toContain('_devports_completion()');
      expect(script).toContain('complete -F _devports_completion devports');
      expect(script).toContain('allocate release list status check');
    });

    it('should throw error for unsupported shell', () => {
      expect(() => generateCompletionScript('fish')).toThrow(
        'Unsupported shell: fish'
      );
      expect(() => generateCompletionScript('unknown')).toThrow(
        'Unsupported shell: unknown'
      );
    });

    it('should handle different shell case variations', () => {
      expect(() => generateCompletionScript('ZSH')).not.toThrow();
      expect(() => generateCompletionScript('BASH')).not.toThrow();
      expect(() => generateCompletionScript('Zsh')).not.toThrow();
    });
  });

  describe('isCompletionInstalled', () => {
    it('should detect installed zsh completion', async () => {
      expect(isCompletionInstalled('zsh')).toBe(false);

      const completionDir = join(tempDir, '.zsh', 'completions');
      await mkdir(completionDir, { recursive: true });
      await writeFile(join(completionDir, '_devports'), 'completion script');

      expect(isCompletionInstalled('zsh')).toBe(true);
    });

    it('should detect installed bash completion', async () => {
      expect(isCompletionInstalled('bash')).toBe(false);

      const completionDir = join(tempDir, '.bash_completion.d');
      await mkdir(completionDir, { recursive: true });
      await writeFile(join(completionDir, 'devports'), 'completion script');

      expect(isCompletionInstalled('bash')).toBe(true);
    });

    it('should return false for unsupported shell', () => {
      expect(isCompletionInstalled('fish')).toBe(false);
    });
  });

  describe('getProjectsForCompletion', () => {
    it('should return sorted unique project names', () => {
      vi.mocked(portManager.listAllocations).mockReturnValue([
        {
          port: 5432,
          project: 'project-b',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2024-01-01T00:00:00Z',
        },
        {
          port: 3000,
          project: 'project-a',
          service: 'api',
          type: 'api',
          allocatedAt: '2024-01-01T00:00:00Z',
        },
        {
          port: 5433,
          project: 'project-b',
          service: 'postgres-2',
          type: 'postgres',
          allocatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      const projects = getProjectsForCompletion();
      expect(projects).toEqual(['project-a', 'project-b']);
    });

    it('should return empty array when no allocations exist', () => {
      vi.mocked(portManager.listAllocations).mockReturnValue([]);

      const projects = getProjectsForCompletion();
      expect(projects).toEqual([]);
    });

    it('should handle errors gracefully', () => {
      vi.mocked(portManager.listAllocations).mockImplementation(() => {
        throw new Error('Registry not found');
      });

      const projects = getProjectsForCompletion();
      expect(projects).toEqual([]);
    });
  });

  describe('getServicesForCompletion', () => {
    it('should return sorted unique service names for a project', () => {
      vi.mocked(portManager.listAllocations).mockReturnValue([
        {
          port: 5432,
          project: 'myproject',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2024-01-01T00:00:00Z',
        },
        {
          port: 3000,
          project: 'myproject',
          service: 'api',
          type: 'api',
          allocatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      const services = getServicesForCompletion('myproject');
      expect(services).toEqual(['api', 'postgres']);

      // Verify it was called with project filter
      expect(portManager.listAllocations).toHaveBeenCalledWith({
        project: 'myproject',
      });
    });

    it('should return empty array when project has no allocations', () => {
      vi.mocked(portManager.listAllocations).mockReturnValue([]);

      const services = getServicesForCompletion('nonexistent');
      expect(services).toEqual([]);
    });

    it('should handle errors gracefully', () => {
      vi.mocked(portManager.listAllocations).mockImplementation(() => {
        throw new Error('Registry not found');
      });

      const services = getServicesForCompletion('myproject');
      expect(services).toEqual([]);
    });
  });

  describe('completion script content validation', () => {
    it('zsh completion should contain all supported commands', () => {
      const script = generateCompletionScript('zsh');

      const expectedCommands = [
        'allocate',
        'release',
        'list',
        'status',
        'check',
        'reserve',
        'unreserve',
        'info',
        'render',
        'gitignore',
        'setup',
        'worktree',
        'completion',
      ];

      expectedCommands.forEach((cmd) => {
        expect(script).toContain(cmd);
      });
    });

    it('zsh completion should contain dynamic type completion', () => {
      const script = generateCompletionScript('zsh');

      expect(script).toContain('devports list --completion types');
    });

    it('bash completion should handle common flags', () => {
      const script = generateCompletionScript('bash');

      expect(script).toContain('--quiet');
      expect(script).toContain('--json');
      expect(script).toContain('--all');
      expect(script).toContain('--type');
    });

    it('completion scripts should be executable shell code', () => {
      const zshScript = generateCompletionScript('zsh');
      const bashScript = generateCompletionScript('bash');

      // Basic shell syntax checks
      expect(zshScript).toContain('_devports() {');
      expect(zshScript).toMatch(/case .* in/);
      expect(zshScript).toContain('esac');
      expect(zshScript).toContain('#!/bin/zsh');

      expect(bashScript).toContain('_devports_completion() {');
      expect(bashScript).toContain('complete -F');
      expect(bashScript).toContain('#!/bin/bash');
    });

    it('zsh completion should handle release command with position-based logic', () => {
      const script = generateCompletionScript('zsh');

      // Check for position-based completion ($CURRENT checks)
      expect(script).toContain('if [[ $CURRENT -eq 2 ]]; then');
      expect(script).toContain('if [[ $CURRENT -eq 3 ]]; then');
      expect(script).toContain('elif [[ $CURRENT -eq 4 ]]; then');

      // Check for --port flag handling in release command
      expect(script).toContain('if [[ ${words[*]} =~ "--port" ]]');
    });

    it('zsh completion should use compadd for direct completions', () => {
      const script = generateCompletionScript('zsh');

      // Should use compadd instead of _describe
      expect(script).toContain('compadd -a projects');
      expect(script).toContain('compadd -a services');
      expect(script).toContain('compadd allocate release list');
    });

    it('bash completion should use new --completion flag for dynamic data', () => {
      const script = generateCompletionScript('bash');

      // Should use the new --completion flag
      expect(script).toContain('devports release --completion projects');
      expect(script).toContain(
        'devports release --completion services --project "$project"'
      );
      expect(script).toContain('devports allocate --completion types');
    });

    it('zsh completion should handle worktree subcommands', () => {
      const script = generateCompletionScript('zsh');

      expect(script).toContain('worktree)');
      expect(script).toContain('add:Create a git worktree');
      expect(script).toContain('remove:Remove a git worktree');
    });

    it('completion scripts should handle project filtering for services', () => {
      const script = generateCompletionScript('zsh');

      // Service completion should filter by project
      expect(script).toContain(
        'devports list --project "$project" --completion services'
      );
    });

    it('bash completion should handle release command service completion', () => {
      const script = generateCompletionScript('bash');

      // Should handle cword 3 (service position) for release command
      expect(script).toContain('3)');
      expect(script).toContain('case ${words[1]} in');
      expect(script).toContain('release)');
      expect(script).toContain('local project=${words[2]}');
      expect(script).toContain(
        'devports list --project "$project" --completion services'
      );
    });
  });
});
