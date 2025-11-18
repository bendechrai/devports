/**
 * Consolidated validation service - eliminates duplication in validation logic
 * Implements configurable validation patterns for DRY compliance
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Configuration for string validation
 */
export interface StringValidationConfig {
  name: string;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  disallowedPrefixes?: string[];
  required?: boolean;
  customErrorMessage?: string;
}

/**
 * Configuration for path validation
 */
export interface PathValidationConfig {
  name: string;
  mustExist?: boolean;
  allowRelative?: boolean;
  allowedExtensions?: string[];
  maxLength?: number;
  customErrorMessage?: string;
}

/**
 * Configuration for numeric validation
 */
export interface NumericValidationConfig {
  name: string;
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
  customErrorMessage?: string;
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  PROJECT_SERVICE: /^[a-zA-Z0-9._-]+$/,
  BRANCH_NAME: /^[a-zA-Z0-9._/-]+$/,
  SAFE_PATH: /^[a-zA-Z0-9._/-]+$/,
  SHELL_DANGEROUS: /[;|&$`<>(){}[\]"'\\*?~]/,
} as const;

/**
 * Predefined validation configurations for common use cases
 */
export const ValidationConfigs = {
  PROJECT_NAME: {
    name: 'Project name',
    maxLength: 50,
    pattern: ValidationPatterns.PROJECT_SERVICE,
    disallowedPrefixes: ['.', '-'],
    required: true,
  } as StringValidationConfig,

  SERVICE_NAME: {
    name: 'Service name',
    maxLength: 30,
    pattern: ValidationPatterns.PROJECT_SERVICE,
    disallowedPrefixes: ['.', '-'],
    required: true,
  } as StringValidationConfig,

  BRANCH_NAME: {
    name: 'Branch name',
    maxLength: 100,
    pattern: ValidationPatterns.BRANCH_NAME,
    required: true,
  } as StringValidationConfig,

  PORT_NUMBER: {
    name: 'Port number',
    min: 1024,
    max: 65535,
    integer: true,
    required: true,
  } as NumericValidationConfig,

  TEMPLATE_PATH: {
    name: 'Template path',
    allowedExtensions: ['.devports'],
    maxLength: 500,
    allowRelative: true,
  } as PathValidationConfig,

  WORKTREE_PATH: {
    name: 'Worktree path',
    maxLength: 500,
    allowRelative: true,
  } as PathValidationConfig,

  OUTPUT_PATH: {
    name: 'Output path',
    maxLength: 500,
    allowRelative: true,
  } as PathValidationConfig,
} as const;

/**
 * Centralized validation service with configurable validators
 */
export class ValidationService {
  /**
   * Validate a string value with configurable rules
   */
  static validateString(value: string, config: StringValidationConfig): string {
    // Required check
    if (config.required && (!value || typeof value !== 'string')) {
      throw new ValidationError(
        config.customErrorMessage ?? `${config.name} is required`
      );
    }

    if (!value) {
      return '';
    }

    // Length validation
    if (config.maxLength && value.length > config.maxLength) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} must be ${config.maxLength} characters or less`
      );
    }

    if (config.minLength && value.length < config.minLength) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} must be at least ${config.minLength} characters`
      );
    }

    // Pattern validation
    if (config.pattern && !config.pattern.test(value)) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} can only contain letters, numbers, dots, underscores, and hyphens`
      );
    }

    // Prefix validation
    if (config.disallowedPrefixes) {
      for (const prefix of config.disallowedPrefixes) {
        if (value.startsWith(prefix)) {
          throw new ValidationError(
            config.customErrorMessage ??
              `${config.name} cannot start with "${prefix}"`
          );
        }
      }
    }

    return value.trim();
  }

  /**
   * Validate a numeric value with configurable rules
   */
  static validateNumber(
    value: string | number,
    config: NumericValidationConfig
  ): number {
    // Required check
    if (
      config.required &&
      (value === undefined || value === null || value === '')
    ) {
      throw new ValidationError(
        config.customErrorMessage ?? `${config.name} is required`
      );
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      throw new ValidationError(
        config.customErrorMessage ?? `${config.name} must be a valid number`
      );
    }

    // Integer check
    if (config.integer && !Number.isInteger(numValue)) {
      throw new ValidationError(
        config.customErrorMessage ?? `${config.name} must be an integer`
      );
    }

    // Range validation
    if (config.min !== undefined && numValue < config.min) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} must be at least ${config.min}`
      );
    }

    if (config.max !== undefined && numValue > config.max) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} must be at most ${config.max}`
      );
    }

    return numValue;
  }

  /**
   * Validate a path with configurable rules
   */
  static validatePath(value: string, config: PathValidationConfig): string {
    if (!value || typeof value !== 'string') {
      throw new ValidationError(
        config.customErrorMessage ?? `${config.name} is required`
      );
    }

    // Length validation
    if (config.maxLength && value.length > config.maxLength) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} must be ${config.maxLength} characters or less`
      );
    }

    // Extension validation
    if (config.allowedExtensions && config.allowedExtensions.length > 0) {
      const hasValidExtension = config.allowedExtensions.some((ext) =>
        value.endsWith(ext)
      );
      if (!hasValidExtension) {
        throw new ValidationError(
          config.customErrorMessage ??
            `${config.name} must have one of these extensions: ${config.allowedExtensions.join(', ')}`
        );
      }
    }

    // Shell metacharacter check for security
    if (ValidationPatterns.SHELL_DANGEROUS.test(value)) {
      throw new ValidationError(
        config.customErrorMessage ??
          `${config.name} contains dangerous characters that could be used for shell injection`
      );
    }

    return value.trim();
  }

  /**
   * Convenience methods using predefined configurations
   */
  static validateProjectName(value: string): string {
    return this.validateString(value, ValidationConfigs.PROJECT_NAME);
  }

  static validateServiceName(value: string): string {
    return this.validateString(value, ValidationConfigs.SERVICE_NAME);
  }

  static validateBranchName(value: string): string {
    return this.validateString(value, ValidationConfigs.BRANCH_NAME);
  }

  static validatePort(value: string | number): number {
    return this.validateNumber(value, ValidationConfigs.PORT_NUMBER);
  }

  static validateTemplatePath(value: string): string {
    return this.validatePath(value, ValidationConfigs.TEMPLATE_PATH);
  }

  static validateWorktreePath(value: string): string {
    return this.validatePath(value, ValidationConfigs.WORKTREE_PATH);
  }

  static validateOutputPath(value: string): string {
    return this.validatePath(value, ValidationConfigs.OUTPUT_PATH);
  }

  /**
   * Validate service type against allowed types
   */
  static validateServiceType(type: string): string {
    if (!type || typeof type !== 'string') {
      throw new ValidationError('Service type is required');
    }

    const validTypes = ['postgres', 'mysql', 'redis', 'api', 'app', 'custom'];
    const normalizedType = type.toLowerCase().trim();

    if (!validTypes.includes(normalizedType)) {
      throw new ValidationError(
        `Invalid service type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    return normalizedType;
  }

  /**
   * Validate script file path for post-hooks and similar
   */
  static validateScriptPath(path: string): string {
    // Uses the same validation logic as template paths but with script-specific extensions
    return this.validatePath(path, {
      name: 'script path',
      maxLength: 200,
      mustExist: true,
      allowRelative: true,
      allowedExtensions: [
        '.sh',
        '.bash',
        '.zsh',
        '.js',
        '.mjs',
        '.ts',
        '.py',
        '.rb',
      ],
    });
  }

  /**
   * Validate an array of service definitions in "service" or "service:type" format
   */
  static validateServices(
    services: string[]
  ): Array<{ service: string; type: string }> {
    if (!Array.isArray(services)) {
      throw new ValidationError('Services must be an array');
    }

    return services.map((serviceStr, index) => {
      if (!serviceStr || typeof serviceStr !== 'string') {
        throw new ValidationError(`Service at index ${index} is invalid`);
      }

      const trimmed = serviceStr.trim();
      const parts = trimmed.split(':');

      if (parts.length === 1) {
        // Format: service (use same name for type)
        const service = this.validateServiceName(parts[0]);
        const type = this.validateServiceType(parts[0]);
        return { service, type };
      } else if (parts.length === 2) {
        // Format: service:type
        const service = this.validateServiceName(parts[0]);
        const type = this.validateServiceType(parts[1]);
        return { service, type };
      } else {
        throw new ValidationError(
          `Invalid service format at index ${index}. Use 'service' or 'service:type'`
        );
      }
    });
  }

  /**
   * Sanitize string for safe display/logging, removing dangerous characters
   */
  static sanitizeForDisplay(input: string, maxLength: number = 100): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove control characters and limit length
    return (
      input
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .substring(0, maxLength)
    );
  }
}
