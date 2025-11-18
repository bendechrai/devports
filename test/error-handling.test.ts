import { describe, it, expect, vi } from 'vitest';
import { handleCommandError } from '../src/commands/base-command.js';
import { ValidationError } from '../src/validation.js';

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle ValidationError with custom message', () => {
    const error = new ValidationError('Invalid port number');
    const options = { json: false, quiet: false };

    expect(() => handleCommandError(error, options)).toThrow(
      'process.exit called'
    );
    expect(console.error).toHaveBeenCalledWith('❌ Invalid port number');
  });

  it('should handle generic errors', () => {
    const error = new Error('Something went wrong');
    const options = { json: false, quiet: false };

    expect(() => handleCommandError(error, options)).toThrow(
      'process.exit called'
    );
    expect(console.error).toHaveBeenCalledWith('❌ Something went wrong');
  });

  it('should output JSON errors when json flag is set', () => {
    const error = new Error('Test error');
    const options = { json: true, quiet: false };

    expect(() => handleCommandError(error, options)).toThrow(
      'process.exit called'
    );
    expect(console.error).toHaveBeenCalledWith(
      '{"success":false,"error":"Test error"}'
    );
  });

  it('should suppress output in quiet mode', () => {
    const error = new Error('Test error');
    const options = { json: false, quiet: true };

    expect(() => handleCommandError(error, options)).toThrow(
      'process.exit called'
    );
    expect(console.error).not.toHaveBeenCalled();
  });
});
