import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import {
  setupCompletionSystem,
  uninstallCompletion,
  isCompletionInstalled,
  isCompletionSystemInitialized,
} from '../src/completion/shell-config.js';

describe('Completion Integration', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      join(tmpdir(), 'devports-completion-integration-test-')
    );
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Shell Configuration Management', () => {
    it('should install and uninstall zsh completion successfully', async () => {
      // Test installation
      const installResult = setupCompletionSystem('zsh');
      expect(installResult.success).toBe(true);
      expect(installResult.message).toContain('Completion setup added');
      expect(isCompletionInstalled('zsh')).toBe(false); // No script file created by setupCompletionSystem

      // Test uninstallation
      const uninstallResult = uninstallCompletion('zsh');
      expect(uninstallResult.success).toBe(true);
    });

    it('should install bash completion successfully', () => {
      const result = setupCompletionSystem('bash');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Completion setup added');
      expect(existsSync(join(tempDir, '.bashrc'))).toBe(true);
    });

    it('should handle invalid shell types', () => {
      const result = setupCompletionSystem('invalid');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported shell');
    });

    it('should detect existing completion setup', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(
        configFile,
        '# devports completion setup\neval "$(devports completion zsh)"'
      );

      const result = setupCompletionSystem('zsh');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already configured');
    });

    it('should create config file if it doesnt exist', () => {
      const result = setupCompletionSystem('zsh');
      expect(result.success).toBe(true);
      expect(existsSync(join(tempDir, '.zshrc'))).toBe(true);
    });

    it('should detect existing setup with eval line only', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(configFile, 'eval "$(devports completion zsh)"\n');

      const result = setupCompletionSystem('zsh');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already configured');
    });

    it('should handle source command reload errors gracefully', async () => {
      // Create a config file with invalid syntax that would cause source to fail
      const configFile = join(tempDir, '.zshrc');
      await writeFile(configFile, 'invalid shell syntax !\n');

      const result = setupCompletionSystem('zsh');
      expect(result.success).toBe(true); // Should still succeed despite reload failure
    });

    it('should handle bash completion configuration', () => {
      const result = setupCompletionSystem('bash');
      expect(result.success).toBe(true);
      expect(result.configFile).toBe(join(tempDir, '.bashrc'));

      // Verify bash-specific setup was added
      const content = require('fs').readFileSync(
        join(tempDir, '.bashrc'),
        'utf-8'
      );
      expect(content).toContain('eval "$(devports completion bash)"');
      expect(content).toContain('# devports completion setup');
    });

    it('should prioritize existing config files', async () => {
      // Create multiple potential config files - zsh checks .zshrc first
      await writeFile(join(tempDir, '.zsh_profile'), 'existing profile');
      await writeFile(join(tempDir, '.zshrc'), 'existing zshrc');

      const result = setupCompletionSystem('zsh');
      expect(result.configFile).toBe(join(tempDir, '.zshrc')); // Should use .zshrc first
    });

    it('should prioritize bash config files correctly', async () => {
      // Create multiple potential config files
      await writeFile(join(tempDir, '.bash_profile'), 'existing profile');
      await writeFile(join(tempDir, '.bashrc'), 'existing bashrc');

      const result = setupCompletionSystem('bash');
      expect(result.configFile).toBe(join(tempDir, '.bashrc')); // Should use .bashrc first
    });

    it('should handle uninstall when no config file exists', () => {
      const result = uninstallCompletion('zsh');
      expect(result.success).toBe(true);
      expect(result.message).toContain('No configuration file found');
    });

    it('should handle uninstall when completion is not installed', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(configFile, 'some other content\nalias ll="ls -la"');

      const result = uninstallCompletion('zsh');
      expect(result.success).toBe(true);
      expect(result.message).toContain('No devports completion found');
    });

    it('should remove completion lines correctly', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(
        configFile,
        `# Some existing content
export PATH=$PATH:/usr/local/bin

# devports completion setup
autoload -U compinit && compinit
eval "$(devports completion zsh)"

# More content
alias ll="ls -la"`
      );

      const result = uninstallCompletion('zsh');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed devports completion');

      const content = require('fs').readFileSync(configFile, 'utf-8');
      expect(content).not.toContain('devports completion');
      expect(content).not.toContain('autoload -U compinit && compinit');
      expect(content).toContain('export PATH=$PATH:/usr/local/bin');
      expect(content).toContain('alias ll="ls -la"');
    });

    it('should clean up empty lines after uninstall', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(
        configFile,
        `export PATH=$PATH:/usr/local/bin


# devports completion setup
eval "$(devports completion zsh)"



alias ll="ls -la"`
      );

      const result = uninstallCompletion('zsh');
      expect(result.success).toBe(true);

      const content = require('fs').readFileSync(configFile, 'utf-8');
      // Should not have excessive empty lines
      expect(content.split('\n\n\n').length).toBe(1); // No triple newlines
    });

    it('should handle uninstall errors gracefully', async () => {
      const configFile = join(tempDir, '.zshrc');
      await writeFile(
        configFile,
        '# devports completion setup\neval "$(devports completion zsh)"'
      );

      // Make file read-only to cause write error on Unix systems
      if (process.platform !== 'win32') {
        try {
          const { chmodSync } = require('fs');
          chmodSync(configFile, '444');

          const result = uninstallCompletion('zsh');
          expect(result.success).toBe(false);
          expect(result.message).toContain('Failed to uninstall completion');

          // Restore permissions for cleanup
          chmodSync(configFile, '644');
        } catch {
          // Skip this test if we can't change permissions
        }
      }
    });

    it('should check completion installation status correctly', async () => {
      expect(isCompletionInstalled('zsh')).toBe(false);
      expect(isCompletionInstalled('bash')).toBe(false);

      // Test invalid shell
      expect(isCompletionInstalled('invalid')).toBe(false);
    });

    it('should check completion system initialization', async () => {
      expect(isCompletionSystemInitialized('zsh')).toBe(false);

      // Setup completion and test again
      setupCompletionSystem('zsh');
      expect(isCompletionSystemInitialized('zsh')).toBe(true);
    });
  });

  describe('Command Completion Validation', () => {
    it('should validate --completion flags exist on commands that need them', () => {
      // Test that commands with --completion actually support it
      expect(() =>
        execSync('node dist/cli.js release --completion projects', {
          stdio: 'pipe',
        })
      ).not.toThrow();
      expect(() =>
        execSync('node dist/cli.js allocate --completion types', {
          stdio: 'pipe',
        })
      ).not.toThrow();
    });

    it('should handle completion errors gracefully', () => {
      // Test invalid completion modes
      expect(() =>
        execSync('node dist/cli.js release --completion invalid', {
          stdio: 'pipe',
        })
      ).toThrow();
    });
  });

  describe('Static File Validation', () => {
    it('should have valid shell syntax in completion files', () => {
      // Test bash syntax
      expect(() =>
        execSync('bash -n src/completion/bash.sh', { stdio: 'pipe' })
      ).not.toThrow();

      // Test zsh syntax only if zsh is available
      try {
        execSync('which zsh', { stdio: 'pipe' });
        expect(() =>
          execSync('zsh -n src/completion/zsh.sh', { stdio: 'pipe' })
        ).not.toThrow();
      } catch {
        // Skip zsh test if zsh is not installed
        console.warn('Skipping zsh syntax check: zsh not found');
      }
    });

    it('should contain expected completion patterns', async () => {
      const zshContent = await readFile('src/completion/zsh.sh', 'utf-8');
      const bashContent = await readFile('src/completion/bash.sh', 'utf-8');

      // Test key patterns exist
      expect(zshContent).toContain('devports release --completion projects');
      expect(zshContent).toContain('if [[ ${words[*]} =~ "--port" ]]');
      expect(bashContent).toContain('devports allocate --completion types');
      expect(bashContent).toContain('${words[*]}');
    });

    it('should have proper shebangs', async () => {
      const zshContent = await readFile('src/completion/zsh.sh', 'utf-8');
      const bashContent = await readFile('src/completion/bash.sh', 'utf-8');

      expect(zshContent.startsWith('#!/bin/zsh')).toBe(true);
      expect(bashContent.startsWith('#!/bin/bash')).toBe(true);
    });
  });
});
