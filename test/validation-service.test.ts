import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  ValidationService,
  ValidationPatterns,
  ValidationConfigs,
  StringValidationConfig,
  NumericValidationConfig,
  PathValidationConfig,
} from '../src/services/validation-service.js';

describe('ValidationError', () => {
  it('should create error with message and correct name', () => {
    const error = new ValidationError('Test error message');
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('ValidationError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ValidationPatterns', () => {
  it('should have correct regex patterns', () => {
    expect(ValidationPatterns.PROJECT_SERVICE).toEqual(/^[a-zA-Z0-9._-]+$/);
    expect(ValidationPatterns.BRANCH_NAME).toEqual(/^[a-zA-Z0-9._/-]+$/);
    expect(ValidationPatterns.SAFE_PATH).toEqual(/^[a-zA-Z0-9._/-]+$/);
    expect(ValidationPatterns.SHELL_DANGEROUS).toEqual(
      /[;|&$`<>(){}[\]"'\\*?~]/
    );
  });

  it('should match valid project/service names', () => {
    expect(ValidationPatterns.PROJECT_SERVICE.test('valid-name')).toBe(true);
    expect(ValidationPatterns.PROJECT_SERVICE.test('valid_name')).toBe(true);
    expect(ValidationPatterns.PROJECT_SERVICE.test('valid.name')).toBe(true);
    expect(ValidationPatterns.PROJECT_SERVICE.test('valid123')).toBe(true);
  });

  it('should reject invalid project/service names', () => {
    expect(ValidationPatterns.PROJECT_SERVICE.test('invalid name')).toBe(false);
    expect(ValidationPatterns.PROJECT_SERVICE.test('invalid@name')).toBe(false);
    expect(ValidationPatterns.PROJECT_SERVICE.test('invalid!name')).toBe(false);
  });

  it('should detect dangerous shell characters', () => {
    expect(ValidationPatterns.SHELL_DANGEROUS.test('safe-name')).toBe(false);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous;cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous|cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous&cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous$cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous`cmd`')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous<cmd>')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous(cmd)')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous{cmd}')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous[cmd]')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous"cmd"')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test("dangerous'cmd'")).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous\\cmd')).toBe(
      true
    );
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous*cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous?cmd')).toBe(true);
    expect(ValidationPatterns.SHELL_DANGEROUS.test('dangerous~cmd')).toBe(true);
  });
});

describe('ValidationService.validateString', () => {
  const basicConfig: StringValidationConfig = {
    name: 'Test Field',
    required: true,
  };

  describe('required validation', () => {
    it('should pass with valid string', () => {
      expect(ValidationService.validateString('valid', basicConfig)).toBe(
        'valid'
      );
    });

    it('should fail when required and empty', () => {
      expect(() => ValidationService.validateString('', basicConfig)).toThrow(
        'Test Field is required'
      );
    });

    it('should fail when required and null/undefined', () => {
      expect(() =>
        ValidationService.validateString(null as any, basicConfig)
      ).toThrow('Test Field is required');
      expect(() =>
        ValidationService.validateString(undefined as any, basicConfig)
      ).toThrow('Test Field is required');
    });

    it('should fail when required and not a string', () => {
      expect(() =>
        ValidationService.validateString(123 as any, basicConfig)
      ).toThrow('Test Field is required');
    });

    it('should return empty string when not required and empty', () => {
      const config = { ...basicConfig, required: false };
      expect(ValidationService.validateString('', config)).toBe('');
      expect(ValidationService.validateString(null as any, config)).toBe('');
    });

    it('should use custom error message for required field', () => {
      const config = {
        ...basicConfig,
        customErrorMessage: 'Custom required error',
      };
      expect(() => ValidationService.validateString('', config)).toThrow(
        'Custom required error'
      );
    });
  });

  describe('length validation', () => {
    it('should enforce maxLength', () => {
      const config = { ...basicConfig, maxLength: 5 };
      expect(ValidationService.validateString('short', config)).toBe('short');
      expect(() => ValidationService.validateString('toolong', config)).toThrow(
        'Test Field must be 5 characters or less'
      );
    });

    it('should enforce minLength', () => {
      const config = { ...basicConfig, minLength: 3 };
      expect(ValidationService.validateString('long', config)).toBe('long');
      expect(() => ValidationService.validateString('hi', config)).toThrow(
        'Test Field must be at least 3 characters'
      );
    });

    it('should use custom error message for length validation', () => {
      const config = {
        ...basicConfig,
        maxLength: 5,
        customErrorMessage: 'Custom length error',
      };
      expect(() => ValidationService.validateString('toolong', config)).toThrow(
        'Custom length error'
      );
    });
  });

  describe('pattern validation', () => {
    it('should enforce pattern matching', () => {
      const config = { ...basicConfig, pattern: /^[a-z]+$/ };
      expect(ValidationService.validateString('valid', config)).toBe('valid');
      expect(() => ValidationService.validateString('INVALID', config)).toThrow(
        'Test Field can only contain letters, numbers, dots, underscores, and hyphens'
      );
    });

    it('should use custom error message for pattern validation', () => {
      const config = {
        ...basicConfig,
        pattern: /^[a-z]+$/,
        customErrorMessage: 'Custom pattern error',
      };
      expect(() => ValidationService.validateString('INVALID', config)).toThrow(
        'Custom pattern error'
      );
    });
  });

  describe('prefix validation', () => {
    it('should enforce disallowed prefixes', () => {
      const config = { ...basicConfig, disallowedPrefixes: ['.', '-'] };
      expect(ValidationService.validateString('valid', config)).toBe('valid');
      expect(() =>
        ValidationService.validateString('.invalid', config)
      ).toThrow('Test Field cannot start with "."');
      expect(() =>
        ValidationService.validateString('-invalid', config)
      ).toThrow('Test Field cannot start with "-"');
    });

    it('should use custom error message for prefix validation', () => {
      const config = {
        ...basicConfig,
        disallowedPrefixes: ['.'],
        customErrorMessage: 'Custom prefix error',
      };
      expect(() =>
        ValidationService.validateString('.invalid', config)
      ).toThrow('Custom prefix error');
    });
  });

  it('should trim whitespace from result', () => {
    expect(ValidationService.validateString('  spaced  ', basicConfig)).toBe(
      'spaced'
    );
  });
});

describe('ValidationService.validateNumber', () => {
  const basicConfig: NumericValidationConfig = {
    name: 'Test Number',
    required: true,
  };

  describe('required validation', () => {
    it('should pass with valid number', () => {
      expect(ValidationService.validateNumber(42, basicConfig)).toBe(42);
      expect(ValidationService.validateNumber('42', basicConfig)).toBe(42);
    });

    it('should fail when required and undefined/null/empty', () => {
      expect(() =>
        ValidationService.validateNumber(undefined as any, basicConfig)
      ).toThrow('Test Number is required');
      expect(() =>
        ValidationService.validateNumber(null as any, basicConfig)
      ).toThrow('Test Number is required');
      expect(() => ValidationService.validateNumber('', basicConfig)).toThrow(
        'Test Number is required'
      );
    });

    it('should use custom error message for required field', () => {
      const config = {
        ...basicConfig,
        customErrorMessage: 'Custom required error',
      };
      expect(() =>
        ValidationService.validateNumber(undefined as any, config)
      ).toThrow('Custom required error');
    });
  });

  describe('number parsing', () => {
    it('should parse string numbers', () => {
      expect(ValidationService.validateNumber('42', basicConfig)).toBe(42);
      expect(ValidationService.validateNumber('42.5', basicConfig)).toBe(42.5);
    });

    it('should fail on invalid numbers', () => {
      expect(() =>
        ValidationService.validateNumber('not-a-number', basicConfig)
      ).toThrow('Test Number must be a valid number');
      expect(() =>
        ValidationService.validateNumber('NaN', basicConfig)
      ).toThrow('Test Number must be a valid number');
    });

    it('should use custom error message for invalid number', () => {
      const config = {
        ...basicConfig,
        customErrorMessage: 'Custom number error',
      };
      expect(() => ValidationService.validateNumber('invalid', config)).toThrow(
        'Custom number error'
      );
    });
  });

  describe('integer validation', () => {
    it('should enforce integer requirement', () => {
      const config = { ...basicConfig, integer: true };
      expect(ValidationService.validateNumber(42, config)).toBe(42);
      expect(() => ValidationService.validateNumber(42.5, config)).toThrow(
        'Test Number must be an integer'
      );
    });

    it('should use custom error message for integer validation', () => {
      const config = {
        ...basicConfig,
        integer: true,
        customErrorMessage: 'Custom integer error',
      };
      expect(() => ValidationService.validateNumber(42.5, config)).toThrow(
        'Custom integer error'
      );
    });
  });

  describe('range validation', () => {
    it('should enforce minimum value', () => {
      const config = { ...basicConfig, min: 10 };
      expect(ValidationService.validateNumber(15, config)).toBe(15);
      expect(() => ValidationService.validateNumber(5, config)).toThrow(
        'Test Number must be at least 10'
      );
    });

    it('should enforce maximum value', () => {
      const config = { ...basicConfig, max: 100 };
      expect(ValidationService.validateNumber(50, config)).toBe(50);
      expect(() => ValidationService.validateNumber(150, config)).toThrow(
        'Test Number must be at most 100'
      );
    });

    it('should use custom error message for range validation', () => {
      const config = {
        ...basicConfig,
        min: 10,
        customErrorMessage: 'Custom range error',
      };
      expect(() => ValidationService.validateNumber(5, config)).toThrow(
        'Custom range error'
      );
    });
  });
});

describe('ValidationService.validatePath', () => {
  const basicConfig: PathValidationConfig = {
    name: 'Test Path',
  };

  describe('required validation', () => {
    it('should pass with valid path', () => {
      expect(ValidationService.validatePath('/valid/path', basicConfig)).toBe(
        '/valid/path'
      );
    });

    it('should fail when empty or not a string', () => {
      expect(() => ValidationService.validatePath('', basicConfig)).toThrow(
        'Test Path is required'
      );
      expect(() =>
        ValidationService.validatePath(null as any, basicConfig)
      ).toThrow('Test Path is required');
      expect(() =>
        ValidationService.validatePath(undefined as any, basicConfig)
      ).toThrow('Test Path is required');
    });

    it('should use custom error message for required field', () => {
      const config = {
        ...basicConfig,
        customErrorMessage: 'Custom path error',
      };
      expect(() => ValidationService.validatePath('', config)).toThrow(
        'Custom path error'
      );
    });
  });

  describe('length validation', () => {
    it('should enforce maxLength', () => {
      const config = { ...basicConfig, maxLength: 10 };
      expect(ValidationService.validatePath('/short', config)).toBe('/short');
      expect(() =>
        ValidationService.validatePath('/very/long/path', config)
      ).toThrow('Test Path must be 10 characters or less');
    });

    it('should use custom error message for length validation', () => {
      const config = {
        ...basicConfig,
        maxLength: 5,
        customErrorMessage: 'Custom length error',
      };
      expect(() => ValidationService.validatePath('/toolong', config)).toThrow(
        'Custom length error'
      );
    });
  });

  describe('extension validation', () => {
    it('should enforce allowed extensions', () => {
      const config = { ...basicConfig, allowedExtensions: ['.txt', '.md'] };
      expect(ValidationService.validatePath('/path/file.txt', config)).toBe(
        '/path/file.txt'
      );
      expect(ValidationService.validatePath('/path/file.md', config)).toBe(
        '/path/file.md'
      );
      expect(() =>
        ValidationService.validatePath('/path/file.js', config)
      ).toThrow('Test Path must have one of these extensions: .txt, .md');
    });

    it('should skip extension validation when no extensions specified', () => {
      expect(
        ValidationService.validatePath('/path/file.anything', basicConfig)
      ).toBe('/path/file.anything');
    });

    it('should use custom error message for extension validation', () => {
      const config = {
        ...basicConfig,
        allowedExtensions: ['.txt'],
        customErrorMessage: 'Custom ext error',
      };
      expect(() =>
        ValidationService.validatePath('/path/file.js', config)
      ).toThrow('Custom ext error');
    });
  });

  describe('shell security validation', () => {
    it('should reject dangerous shell characters', () => {
      expect(() =>
        ValidationService.validatePath('/path;dangerous', basicConfig)
      ).toThrow(
        'Test Path contains dangerous characters that could be used for shell injection'
      );
      expect(() =>
        ValidationService.validatePath('/path|dangerous', basicConfig)
      ).toThrow(
        'Test Path contains dangerous characters that could be used for shell injection'
      );
      expect(() =>
        ValidationService.validatePath('/path&dangerous', basicConfig)
      ).toThrow(
        'Test Path contains dangerous characters that could be used for shell injection'
      );
    });

    it('should use custom error message for security validation', () => {
      const config = {
        ...basicConfig,
        customErrorMessage: 'Custom security error',
      };
      expect(() =>
        ValidationService.validatePath('/path;dangerous', config)
      ).toThrow('Custom security error');
    });
  });

  it('should trim whitespace from result', () => {
    expect(ValidationService.validatePath('  /path/file  ', basicConfig)).toBe(
      '/path/file'
    );
  });
});

describe('ValidationService convenience methods', () => {
  describe('validateProjectName', () => {
    it('should validate valid project names', () => {
      expect(ValidationService.validateProjectName('valid-project')).toBe(
        'valid-project'
      );
      expect(ValidationService.validateProjectName('valid_project')).toBe(
        'valid_project'
      );
      expect(ValidationService.validateProjectName('valid.project')).toBe(
        'valid.project'
      );
    });

    it('should reject invalid project names', () => {
      expect(() => ValidationService.validateProjectName('')).toThrow(
        'Project name is required'
      );
      expect(() => ValidationService.validateProjectName('.invalid')).toThrow(
        'Project name cannot start with "."'
      );
      expect(() => ValidationService.validateProjectName('-invalid')).toThrow(
        'Project name cannot start with "-"'
      );
      expect(() =>
        ValidationService.validateProjectName('invalid@name')
      ).toThrow(
        'Project name can only contain letters, numbers, dots, underscores, and hyphens'
      );
    });
  });

  describe('validateServiceName', () => {
    it('should validate valid service names', () => {
      expect(ValidationService.validateServiceName('valid-service')).toBe(
        'valid-service'
      );
      expect(ValidationService.validateServiceName('postgres')).toBe(
        'postgres'
      );
    });

    it('should reject invalid service names', () => {
      expect(() => ValidationService.validateServiceName('')).toThrow(
        'Service name is required'
      );
      expect(() => ValidationService.validateServiceName('.invalid')).toThrow(
        'Service name cannot start with "."'
      );
    });
  });

  describe('validateBranchName', () => {
    it('should validate valid branch names', () => {
      expect(ValidationService.validateBranchName('feature/branch')).toBe(
        'feature/branch'
      );
      expect(ValidationService.validateBranchName('main')).toBe('main');
      expect(ValidationService.validateBranchName('fix-123')).toBe('fix-123');
    });

    it('should reject invalid branch names', () => {
      expect(() => ValidationService.validateBranchName('')).toThrow(
        'Branch name is required'
      );
    });
  });

  describe('validatePort', () => {
    it('should validate valid ports', () => {
      expect(ValidationService.validatePort(3000)).toBe(3000);
      expect(ValidationService.validatePort('3000')).toBe(3000);
    });

    it('should reject invalid ports', () => {
      expect(() => ValidationService.validatePort(500)).toThrow(
        'Port number must be at least 1024'
      );
      expect(() => ValidationService.validatePort(70000)).toThrow(
        'Port number must be at most 65535'
      );
      expect(() => ValidationService.validatePort(3000.5)).toThrow(
        'Port number must be an integer'
      );
    });
  });

  describe('validateTemplatePath', () => {
    it('should validate valid template paths', () => {
      expect(ValidationService.validateTemplatePath('template.devports')).toBe(
        'template.devports'
      );
      expect(
        ValidationService.validateTemplatePath('/path/to/template.devports')
      ).toBe('/path/to/template.devports');
    });

    it('should reject invalid template paths', () => {
      expect(() =>
        ValidationService.validateTemplatePath('template.txt')
      ).toThrow('Template path must have one of these extensions: .devports');
    });
  });

  describe('validateWorktreePath', () => {
    it('should validate valid worktree paths', () => {
      expect(ValidationService.validateWorktreePath('/path/to/worktree')).toBe(
        '/path/to/worktree'
      );
      expect(ValidationService.validateWorktreePath('relative/path')).toBe(
        'relative/path'
      );
    });

    it('should reject dangerous worktree paths', () => {
      expect(() =>
        ValidationService.validateWorktreePath('/path;dangerous')
      ).toThrow('Worktree path contains dangerous characters');
    });
  });

  describe('validateOutputPath', () => {
    it('should validate valid output paths', () => {
      expect(ValidationService.validateOutputPath('/output/file')).toBe(
        '/output/file'
      );
      expect(ValidationService.validateOutputPath('output.env')).toBe(
        'output.env'
      );
    });

    it('should reject dangerous output paths', () => {
      expect(() =>
        ValidationService.validateOutputPath('/output|dangerous')
      ).toThrow('Output path contains dangerous characters');
    });
  });
});

describe('ValidationService.validateServiceType', () => {
  it('should validate valid service types', () => {
    expect(ValidationService.validateServiceType('postgres')).toBe('postgres');
    expect(ValidationService.validateServiceType('mysql')).toBe('mysql');
    expect(ValidationService.validateServiceType('redis')).toBe('redis');
    expect(ValidationService.validateServiceType('api')).toBe('api');
    expect(ValidationService.validateServiceType('app')).toBe('app');
    expect(ValidationService.validateServiceType('custom')).toBe('custom');
  });

  it('should normalize case and trim', () => {
    expect(ValidationService.validateServiceType('POSTGRES')).toBe('postgres');
    expect(ValidationService.validateServiceType('  MySQL  ')).toBe('mysql');
  });

  it('should reject invalid service types', () => {
    expect(() => ValidationService.validateServiceType('')).toThrow(
      'Service type is required'
    );
    expect(() => ValidationService.validateServiceType(null as any)).toThrow(
      'Service type is required'
    );
    expect(() => ValidationService.validateServiceType('invalid')).toThrow(
      'Invalid service type. Must be one of: postgres, mysql, redis, api, app, custom'
    );
  });
});

describe('ValidationService.validateScriptPath', () => {
  it('should validate valid script paths', () => {
    expect(ValidationService.validateScriptPath('script.sh')).toBe('script.sh');
    expect(ValidationService.validateScriptPath('script.js')).toBe('script.js');
    expect(ValidationService.validateScriptPath('script.py')).toBe('script.py');
  });

  it('should reject scripts with invalid extensions', () => {
    expect(() => ValidationService.validateScriptPath('script.txt')).toThrow(
      'script path must have one of these extensions'
    );
  });

  it('should reject dangerous script paths', () => {
    expect(() =>
      ValidationService.validateScriptPath('dangerous;script.sh')
    ).toThrow('script path contains dangerous characters');
  });
});

describe('ValidationService.validateServices', () => {
  it('should validate valid service arrays', () => {
    const result = ValidationService.validateServices([
      'postgres',
      'redis:redis',
      'api:api',
    ]);
    expect(result).toEqual([
      { service: 'postgres', type: 'postgres' },
      { service: 'redis', type: 'redis' },
      { service: 'api', type: 'api' },
    ]);
  });

  it('should handle services with explicit types', () => {
    const result = ValidationService.validateServices([
      'db:postgres',
      'cache:redis',
    ]);
    expect(result).toEqual([
      { service: 'db', type: 'postgres' },
      { service: 'cache', type: 'redis' },
    ]);
  });

  it('should reject non-arrays', () => {
    expect(() =>
      ValidationService.validateServices('not-array' as any)
    ).toThrow('Services must be an array');
  });

  it('should reject invalid service entries', () => {
    expect(() => ValidationService.validateServices(['', 'valid'])).toThrow(
      'Service at index 0 is invalid'
    );
    expect(() => ValidationService.validateServices([null as any])).toThrow(
      'Service at index 0 is invalid'
    );
  });

  it('should reject invalid service format', () => {
    expect(() =>
      ValidationService.validateServices(['service:type:extra'])
    ).toThrow(
      "Invalid service format at index 0. Use 'service' or 'service:type'"
    );
  });

  it('should reject invalid service names and types', () => {
    expect(() => ValidationService.validateServices(['.invalid'])).toThrow(
      'Service name cannot start with "."'
    );
    expect(() => ValidationService.validateServices(['valid:invalid'])).toThrow(
      'Invalid service type. Must be one of: postgres, mysql, redis, api, app, custom'
    );
  });
});

describe('ValidationService.sanitizeForDisplay', () => {
  it('should return empty string for invalid input', () => {
    expect(ValidationService.sanitizeForDisplay(null as any)).toBe('');
    expect(ValidationService.sanitizeForDisplay(undefined as any)).toBe('');
    expect(ValidationService.sanitizeForDisplay(123 as any)).toBe('');
  });

  it('should remove control characters', () => {
    expect(ValidationService.sanitizeForDisplay('hello\x00world')).toBe(
      'helloworld'
    );
    expect(ValidationService.sanitizeForDisplay('hello\x1Fworld')).toBe(
      'helloworld'
    );
    expect(ValidationService.sanitizeForDisplay('hello\x7Fworld')).toBe(
      'helloworld'
    );
  });

  it('should limit length to default 100 characters', () => {
    const longString = 'a'.repeat(150);
    const result = ValidationService.sanitizeForDisplay(longString);
    expect(result.length).toBe(100);
    expect(result).toBe('a'.repeat(100));
  });

  it('should limit length to custom max length', () => {
    const longString = 'a'.repeat(50);
    const result = ValidationService.sanitizeForDisplay(longString, 20);
    expect(result.length).toBe(20);
    expect(result).toBe('a'.repeat(20));
  });

  it('should preserve normal characters', () => {
    expect(ValidationService.sanitizeForDisplay('Hello World!')).toBe(
      'Hello World!'
    );
    expect(ValidationService.sanitizeForDisplay('test-123_file.ext')).toBe(
      'test-123_file.ext'
    );
  });
});

describe('ValidationConfigs', () => {
  it('should have correct default configurations', () => {
    expect(ValidationConfigs.PROJECT_NAME).toEqual({
      name: 'Project name',
      maxLength: 50,
      pattern: ValidationPatterns.PROJECT_SERVICE,
      disallowedPrefixes: ['.', '-'],
      required: true,
    });

    expect(ValidationConfigs.SERVICE_NAME).toEqual({
      name: 'Service name',
      maxLength: 30,
      pattern: ValidationPatterns.PROJECT_SERVICE,
      disallowedPrefixes: ['.', '-'],
      required: true,
    });

    expect(ValidationConfigs.PORT_NUMBER).toEqual({
      name: 'Port number',
      min: 1024,
      max: 65535,
      integer: true,
      required: true,
    });

    expect(ValidationConfigs.TEMPLATE_PATH).toEqual({
      name: 'Template path',
      allowedExtensions: ['.devports'],
      maxLength: 500,
      allowRelative: true,
    });
  });
});
