/**
 * Input validation utilities for security-critical parameters
 * Designed to prevent command injection and path traversal attacks
 */

import { existsSync, statSync } from 'fs';
import { isAbsolute, normalize } from 'path';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation options for different contexts
 */
export interface ValidationOptions {
  allowRelativePaths?: boolean;
  maxLength?: number;
  allowedExtensions?: string[];
  mustExist?: boolean;
  allowShellMetachars?: boolean;
}

/**
 * Shell metacharacters that could be used for injection
 */
const DANGEROUS_SHELL_CHARS = /[;|&$`<>(){}[\]"'\\*?~]/;

/**
 * Valid characters for project/service names
 */
const PROJECT_SERVICE_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Valid characters for branch names (based on git branch naming rules)
 */
const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9._/-]+$/;

/**
 * Valid port number range
 */
const PORT_MIN = 1024;
const PORT_MAX = 65535;

/**
 * Validate and sanitize a project name
 */
export function validateProjectName(project: string): string {
  if (!project || typeof project !== 'string') {
    throw new ValidationError('Project name is required');
  }

  if (project.length > 50) {
    throw new ValidationError('Project name must be 50 characters or less');
  }

  if (!PROJECT_SERVICE_PATTERN.test(project)) {
    throw new ValidationError(
      'Project name can only contain letters, numbers, dots, underscores, and hyphens'
    );
  }

  if (project.startsWith('.') || project.startsWith('-')) {
    throw new ValidationError('Project name cannot start with a dot or hyphen');
  }

  return project.trim();
}

/**
 * Validate and sanitize a service name
 */
export function validateServiceName(service: string): string {
  if (!service || typeof service !== 'string') {
    throw new ValidationError('Service name is required');
  }

  if (service.length > 30) {
    throw new ValidationError('Service name must be 30 characters or less');
  }

  if (!PROJECT_SERVICE_PATTERN.test(service)) {
    throw new ValidationError(
      'Service name can only contain letters, numbers, dots, underscores, and hyphens'
    );
  }

  if (service.startsWith('.') || service.startsWith('-')) {
    throw new ValidationError('Service name cannot start with a dot or hyphen');
  }

  return service.trim();
}

/**
 * Validate service type against known types
 */
export function validateServiceType(type: string): string {
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
 * Validate port number
 */
export function validatePort(port: string | number): number {
  let portNum: number;

  if (typeof port === 'string') {
    // Check for injection attempts in the string first
    if (DANGEROUS_SHELL_CHARS.test(port)) {
      throw new ValidationError('Port contains invalid characters');
    }

    portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      throw new ValidationError('Port must be a valid number');
    }

    // Ensure the string was purely numeric (no trailing chars)
    if (port.trim() !== portNum.toString()) {
      throw new ValidationError('Port must be a valid number');
    }
  } else {
    portNum = port;
  }

  if (portNum < PORT_MIN || portNum > PORT_MAX) {
    throw new ValidationError(
      `Port must be between ${PORT_MIN} and ${PORT_MAX}`
    );
  }

  return portNum;
}

/**
 * Validate git branch name
 */
export function validateBranchName(branch: string): string {
  if (!branch || typeof branch !== 'string') {
    throw new ValidationError('Branch name is required');
  }

  if (branch.length > 100) {
    throw new ValidationError('Branch name must be 100 characters or less');
  }

  if (!BRANCH_NAME_PATTERN.test(branch)) {
    throw new ValidationError(
      'Branch name contains invalid characters. Only letters, numbers, dots, underscores, forward slashes, and hyphens are allowed'
    );
  }

  // Git branch name restrictions
  if (branch.startsWith('-') || branch.endsWith('.') || branch.includes('..')) {
    throw new ValidationError('Invalid branch name format');
  }

  if (branch.includes(' ')) {
    throw new ValidationError('Branch name cannot contain spaces');
  }

  return branch.trim();
}

/**
 * Validate file path for template files, scripts, etc.
 */
export function validateFilePath(
  path: string,
  options: ValidationOptions = {}
): string {
  if (!path || typeof path !== 'string') {
    throw new ValidationError('File path is required');
  }

  if (path.length > 500) {
    throw new ValidationError('File path is too long (max 500 characters)');
  }

  // Check for shell metacharacters unless explicitly allowed
  if (!options.allowShellMetachars && DANGEROUS_SHELL_CHARS.test(path)) {
    throw new ValidationError('File path contains dangerous characters');
  }

  // Normalize the path to prevent traversal
  const normalizedPath = normalize(path);

  // Check for path traversal attempts
  if (normalizedPath.includes('..')) {
    throw new ValidationError('Path traversal is not allowed');
  }

  // Validate against null bytes and other dangerous sequences
  if (
    normalizedPath.includes('\0') ||
    normalizedPath.includes('\n') ||
    normalizedPath.includes('\r')
  ) {
    throw new ValidationError('File path contains null bytes or newlines');
  }

  // Check if relative paths are allowed
  if (
    !options.allowRelativePaths &&
    !isAbsolute(normalizedPath) &&
    normalizedPath.startsWith('../')
  ) {
    throw new ValidationError(
      'Relative paths outside current directory are not allowed'
    );
  }

  // Validate file extension if specified
  if (options.allowedExtensions && options.allowedExtensions.length > 0) {
    const hasValidExtension = options.allowedExtensions.some((ext) =>
      normalizedPath.toLowerCase().endsWith(ext.toLowerCase())
    );
    if (!hasValidExtension) {
      throw new ValidationError(
        `File must have one of these extensions: ${options.allowedExtensions.join(', ')}`
      );
    }
  }

  // Check if file exists if required
  if (options.mustExist) {
    try {
      if (!existsSync(normalizedPath)) {
        throw new ValidationError(`File does not exist: ${normalizedPath}`);
      }

      const stats = statSync(normalizedPath);
      if (!stats.isFile()) {
        throw new ValidationError(`Path is not a file: ${normalizedPath}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Cannot access file: ${normalizedPath}`);
    }
  }

  return normalizedPath;
}

/**
 * Validate worktree path
 */
export function validateWorktreePath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw new ValidationError('Worktree path is required');
  }

  if (path.length > 300) {
    throw new ValidationError('Worktree path is too long (max 300 characters)');
  }

  // Check for shell metacharacters
  if (DANGEROUS_SHELL_CHARS.test(path)) {
    throw new ValidationError('Worktree path contains dangerous characters');
  }

  // Normalize the path
  const normalizedPath = normalize(path);

  // Check for excessive path traversal attempts (more than 2 levels)
  const traversalCount = (path.match(/\.\./g) ?? []).length;
  if (traversalCount > 2) {
    throw new ValidationError('Excessive path traversal is not allowed');
  }

  // Check for absolute paths to sensitive locations (allow temp directories)
  if (
    normalizedPath.startsWith('/etc/') ||
    normalizedPath.startsWith('/usr/') ||
    normalizedPath.startsWith('/boot/') ||
    normalizedPath.endsWith('/etc/passwd') ||
    normalizedPath.endsWith('/etc/shadow')
  ) {
    throw new ValidationError('Access to system directories is not allowed');
  }

  // Allow /var/ only for temp directories (macOS uses /var/folders/... for temp)
  if (
    normalizedPath.startsWith('/var/') &&
    !normalizedPath.startsWith('/var/folders/') &&
    !normalizedPath.startsWith('/tmp/')
  ) {
    throw new ValidationError('Access to system directories is not allowed');
  }

  // Validate against null bytes
  if (
    normalizedPath.includes('\0') ||
    normalizedPath.includes('\n') ||
    normalizedPath.includes('\r')
  ) {
    throw new ValidationError('Worktree path contains null bytes or newlines');
  }

  // Additional safety - ensure it doesn't start with dangerous sequences
  if (
    normalizedPath.startsWith('/dev/') ||
    normalizedPath.startsWith('/proc/') ||
    normalizedPath.startsWith('/sys/')
  ) {
    throw new ValidationError('Worktree path cannot target system directories');
  }

  return normalizedPath;
}

/**
 * Validate script path for hooks
 */
export function validateScriptPath(path: string): string {
  const validatedPath = validateFilePath(path, {
    allowRelativePaths: true,
    maxLength: 200,
    allowedExtensions: [
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.py',
      '.js',
      '.mjs',
      '.ts',
    ],
    mustExist: true,
  });

  // Additional checks for script execution safety
  try {
    const stats = statSync(validatedPath);

    // Check if it's executable (on Unix-like systems)
    if (process.platform !== 'win32') {
      const mode = stats.mode;
      if (!(mode & parseInt('0100', 8))) {
        // Check if owner has execute permission
        throw new ValidationError('Script file is not executable');
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Cannot verify script permissions: ${validatedPath}`
    );
  }

  return validatedPath;
}

/**
 * Validate service list format (service:type or service)
 */
export function validateServices(
  services: string[]
): Array<{ service: string; type: string }> {
  if (!Array.isArray(services)) {
    throw new ValidationError('Services must be an array');
  }

  if (services.length === 0) {
    throw new ValidationError('At least one service is required');
  }

  if (services.length > 10) {
    throw new ValidationError('Too many services (max 10)');
  }

  return services.map((serviceStr, index) => {
    if (!serviceStr || typeof serviceStr !== 'string') {
      throw new ValidationError(`Service at index ${index} is invalid`);
    }

    const trimmed = serviceStr.trim();
    const parts = trimmed.split(':');

    if (parts.length === 1) {
      // Format: service (use same name for type)
      const service = validateServiceName(parts[0]);
      const type = validateServiceType(parts[0]);
      return { service, type };
    } else if (parts.length === 2) {
      // Format: service:type
      const service = validateServiceName(parts[0]);
      const type = validateServiceType(parts[1]);
      return { service, type };
    } else {
      throw new ValidationError(
        `Invalid service format at index ${index}. Use 'service' or 'service:type'`
      );
    }
  });
}

/**
 * Validate template file path
 */
export function validateTemplatePath(path: string): string {
  return validateFilePath(path, {
    allowRelativePaths: true,
    allowedExtensions: ['.devports', '.env', '.template', '.tmpl'],
    mustExist: true,
  });
}

/**
 * Validate output file path
 */
export function validateOutputPath(path: string): string {
  return validateFilePath(path, {
    allowRelativePaths: true,
    mustExist: false,
  });
}

/**
 * Safe string for display/logging that removes dangerous characters
 */
export function sanitizeForDisplay(
  input: string,
  maxLength: number = 100
): string {
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
