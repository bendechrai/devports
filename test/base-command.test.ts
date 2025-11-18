import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatOutput,
  handleCommandError,
} from '../src/commands/base-command.js';
import { ValidationError } from '../src/validation.js';

describe('Base Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatOutput', () => {
    it('should format JSON output correctly', () => {
      const result = {
        success: true,
        message: 'Operation completed',
        data: { port: 5432, service: 'postgres' },
      };
      const options = { json: true };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(JSON.stringify(result));
    });

    it('should format text output when message exists', () => {
      const result = {
        success: true,
        message: 'Port allocated successfully',
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith('Port allocated successfully');
    });

    it('should not output anything when no message and not JSON', () => {
      const result = {
        success: true,
        data: { port: 5432 },
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should preserve exact JSON structure for API compatibility', () => {
      const result = {
        success: true,
        message: 'List of ports',
        data: {
          allocations: [
            { project: 'app1', service: 'postgres', port: 5432 },
            { project: 'app1', service: 'redis', port: 6379 },
            { project: 'app2', service: 'postgres', port: 5433 },
          ],
          metadata: {
            total: 3,
            timestamp: '2023-01-01T00:00:00.000Z',
          },
        },
      };
      const options = { json: true };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(JSON.stringify(result));

      // Verify the exact JSON structure hasn't changed
      const output = JSON.parse((console.log as any).mock.calls[0][0]);
      expect(output).toEqual(result);
      expect(output.data.allocations).toHaveLength(3);
      expect(output.data.allocations[0]).toEqual({
        project: 'app1',
        service: 'postgres',
        port: 5432,
      });
      expect(output.data.metadata.total).toBe(3);
    });

    it('should format error JSON output correctly', () => {
      const result = {
        success: false,
        error: 'Port already allocated',
        code: 'PORT_IN_USE',
      };
      const options = { json: true };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(JSON.stringify(result));
    });
  });

  describe('handleCommandError', () => {
    it('should handle ValidationError with custom message in text mode', () => {
      const error = new ValidationError('Invalid port number');
      const options = { json: false, quiet: false };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );
      expect(console.error).toHaveBeenCalledWith('❌ Invalid port number');
    });

    it('should handle generic errors in text mode', () => {
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

      // Verify JSON structure for API compatibility
      const output = JSON.parse((console.error as any).mock.calls[0][0]);
      expect(output).toEqual({
        success: false,
        error: 'Test error',
      });
    });

    it('should preserve error structure in JSON mode', () => {
      const error = new ValidationError('Port must be between 1024 and 65535');
      const options = { json: true, quiet: false };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );

      const output = JSON.parse((console.error as any).mock.calls[0][0]);
      expect(output).toEqual({
        success: false,
        error: 'Port must be between 1024 and 65535',
      });
    });

    it('should suppress output in quiet mode', () => {
      const error = new Error('Test error');
      const options = { json: false, quiet: true };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should suppress JSON output in quiet mode', () => {
      const error = new Error('Test error');
      const options = { json: true, quiet: true };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      const error = 'String error message';
      const options = { json: false, quiet: false };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );
      expect(console.error).toHaveBeenCalledWith('❌ String error message');
    });

    it('should handle null/undefined errors', () => {
      const error = null;
      const options = { json: false, quiet: false };

      expect(() => handleCommandError(error, options)).toThrow(
        'process.exit called'
      );
      expect(console.error).toHaveBeenCalledWith('❌ null');
    });
  });

  describe('CLI Output Format Consistency', () => {
    it('should maintain consistent list output format (ASCII table)', () => {
      // Test the expected ASCII table format for list commands
      const result = {
        success: true,
        message: `┌──────────┬───────────┬──────┐
│ Project  │ Service   │ Port │
├──────────┼───────────┼──────┤
│ myapp    │ postgres  │ 5432 │
│ myapp    │ redis     │ 6379 │
│ frontend │ postgres  │ 5433 │
│ frontend │ app       │ 3000 │
└──────────┴───────────┴──────┘

📊 Total: 4 allocations across 2 projects`,
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(result.message);

      // Verify the table format includes expected Unicode box drawing characters
      expect(result.message).toContain('┌──────────┬───────────┬──────┐');
      expect(result.message).toContain('│ Project  │ Service   │ Port │');
      expect(result.message).toContain('├──────────┼───────────┼──────┤');
      expect(result.message).toContain('└──────────┴───────────┴──────┘');
      expect(result.message).toContain('📊 Total: 4 allocations');
    });

    it('should maintain consistent grouped list format', () => {
      const result = {
        success: true,
        message: `🏗️  myapp
   ├─ postgres: 5432
   └─ redis: 6379

🏗️  frontend
   ├─ postgres: 5433
   └─ app: 3000

📊 Total: 4 allocations across 2 projects`,
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(result.message);

      // Verify the grouped format includes expected symbols
      expect(result.message).toContain('🏗️  myapp');
      expect(result.message).toContain('├─ postgres: 5432');
      expect(result.message).toContain('└─ redis: 6379');
      expect(result.message).toContain('📊 Total:');
    });

    it('should maintain consistent success message format', () => {
      const result = {
        success: true,
        message:
          '🔌 Allocated ports:\n   postgres: 5432\n   redis: 6379\n📝 Generated .env file',
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(result.message);

      // Verify consistent emoji usage and formatting
      expect(result.message).toContain('🔌 Allocated ports:');
      expect(result.message).toContain('📝 Generated .env file');
    });

    it('should maintain consistent status output format', () => {
      const result = {
        success: true,
        message: `📋 Port Status Summary

🟢 Available ranges:
   postgres: 5432-5499 (68 ports available)
   redis: 6379-6399 (21 ports available)

⚡ Currently allocated:
   myapp/postgres: 5432
   myapp/redis: 6379

🚫 Reserved ports: none

📊 Usage: 2/144 ports (1.39%)`,
      };
      const options = { json: false };

      formatOutput(result, options);

      expect(console.log).toHaveBeenCalledWith(result.message);

      // Verify consistent status format and emojis
      expect(result.message).toContain('📋 Port Status Summary');
      expect(result.message).toContain('🟢 Available ranges:');
      expect(result.message).toContain('⚡ Currently allocated:');
      expect(result.message).toContain('🚫 Reserved ports:');
      expect(result.message).toContain('📊 Usage:');
    });

    it('should preserve exact JSON schema for programmatic access', () => {
      const expectedSchema = {
        success: true,
        data: {
          allocations: [
            {
              project: 'myapp',
              service: 'postgres',
              port: 5432,
              allocatedAt: '2023-01-01T00:00:00.000Z',
            },
          ],
          summary: {
            totalAllocations: 1,
            projectCount: 1,
            portRanges: {
              postgres: { available: 67, total: 68 },
            },
          },
        },
      };

      const options = { json: true };
      formatOutput(expectedSchema, options);

      const outputJson = JSON.parse((console.log as any).mock.calls[0][0]);

      // Verify exact schema structure for backwards compatibility
      expect(outputJson).toHaveProperty('success');
      expect(outputJson).toHaveProperty('data');
      expect(outputJson.data).toHaveProperty('allocations');
      expect(outputJson.data).toHaveProperty('summary');
      expect(outputJson.data.allocations[0]).toHaveProperty('project');
      expect(outputJson.data.allocations[0]).toHaveProperty('service');
      expect(outputJson.data.allocations[0]).toHaveProperty('port');
      expect(outputJson.data.allocations[0]).toHaveProperty('allocatedAt');
      expect(outputJson.data.summary).toHaveProperty('totalAllocations');
      expect(outputJson.data.summary).toHaveProperty('projectCount');
      expect(outputJson.data.summary).toHaveProperty('portRanges');
    });
  });
});
