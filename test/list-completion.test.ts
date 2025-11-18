import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ListCommand } from '../src/commands/list.command.js';
import { listAllocations } from '../src/port-manager.js';
import { VALID_PORT_TYPES } from '../src/types.js';

// Mock the dependencies
vi.mock('../src/port-manager.js');

describe('List Command Completion', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console.log to capture output
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock process.exit to prevent actual process termination
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called'); // Throw to stop execution instead of actually exiting
    });

    // Set up default empty allocations
    vi.mocked(listAllocations).mockReturnValue([]);
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockProcessExit.mockRestore();
    vi.clearAllMocks();
  });

  describe('projects completion', () => {
    it('should output unique project names and exit', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'myapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 3002,
          project: 'myapp',
          service: 'api',
          type: 'api',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 5435,
          project: 'otherapp',
          service: 'db',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'projects' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog).toHaveBeenCalledWith('myapp');
      expect(mockConsoleLog).toHaveBeenCalledWith('otherapp');
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should output projects in sorted order', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'zebra',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 3002,
          project: 'alpha',
          service: 'api',
          type: 'api',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 5435,
          project: 'beta',
          service: 'db',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'projects' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog.mock.calls[0][0]).toBe('alpha');
      expect(mockConsoleLog.mock.calls[1][0]).toBe('beta');
      expect(mockConsoleLog.mock.calls[2][0]).toBe('zebra');
    });

    it('should handle empty project list', () => {
      vi.mocked(listAllocations).mockReturnValue([]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'projects' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should filter by project option when provided', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'filtered-project',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], {
          completion: 'projects',
          project: 'filtered-project',
        });
      }).toThrow('process.exit called');

      // Should call listAllocations with the project filter
      expect(listAllocations).toHaveBeenCalledWith({
        project: 'filtered-project',
      });
    });
  });

  describe('services completion', () => {
    it('should output unique service names and exit', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'myapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 3002,
          project: 'myapp',
          service: 'api',
          type: 'api',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 5435,
          project: 'otherapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'services' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog).toHaveBeenCalledWith('api');
      expect(mockConsoleLog).toHaveBeenCalledWith('postgres');
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should output services in sorted order', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'myapp',
          service: 'zebra-service',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 3002,
          project: 'myapp',
          service: 'alpha-service',
          type: 'api',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 5435,
          project: 'otherapp',
          service: 'beta-service',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'services' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog.mock.calls[0][0]).toBe('alpha-service');
      expect(mockConsoleLog.mock.calls[1][0]).toBe('beta-service');
      expect(mockConsoleLog.mock.calls[2][0]).toBe('zebra-service');
    });

    it('should handle empty service list', () => {
      vi.mocked(listAllocations).mockReturnValue([]);

      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'services' });
      }).toThrow('process.exit called');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('types completion', () => {
    it('should output all valid port types and exit', () => {
      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'types' });
      }).toThrow('process.exit called');

      // Should output all valid port types
      VALID_PORT_TYPES.forEach((type) => {
        expect(mockConsoleLog).toHaveBeenCalledWith(type);
      });

      expect(mockConsoleLog).toHaveBeenCalledTimes(VALID_PORT_TYPES.length);
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('completion case handling', () => {
    it('should handle uppercase completion modes', () => {
      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'PROJECTS' });
      }).toThrow('process.exit called');

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle mixed case completion modes', () => {
      const command = new ListCommand();

      expect(() => {
        command.execute([], { completion: 'Services' });
      }).toThrow('process.exit called');

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('invalid completion mode', () => {
    it('should handle error for invalid completion mode', () => {
      const command = new ListCommand();

      // handleCommandError calls process.exit, so we expect the mock to throw
      expect(() => {
        command.execute([], { completion: 'invalid-mode' });
      }).toThrow('process.exit called');

      // Should have called process.exit due to error handling
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('completion result format', () => {
    it('should return early from execute when in completion mode', () => {
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'test-project',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();

      // The completion modes call process.exit, so we expect an exception
      expect(() => {
        command.execute([], { completion: 'projects' });
      }).toThrow('process.exit called');

      // Should have handled completion and tried to exit
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });
});
