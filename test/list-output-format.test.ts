import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ListCommand } from '../src/commands/list.command.js';
import { listAllocations, listReservations } from '../src/port-manager.js';

// Mock the dependencies
vi.mock('../src/port-manager.js');

describe('List Command Output Format', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock console.log to capture output
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Set up default empty mocks
    vi.mocked(listAllocations).mockReturnValue([]);
    vi.mocked(listReservations).mockReturnValue([]);
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    vi.clearAllMocks();
  });

  describe('Reservations Section', () => {
    it('should display reservations section when reservations exist', () => {
      // Mock no allocations but some reservations
      vi.mocked(listAllocations).mockReturnValue([]);
      vi.mocked(listReservations).mockReturnValue([
        {
          port: 8080,
          reason: 'Common development server port',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Should contain the reservations header
      expect(output).toMatch(/🔒 Reserved/);

      // Should contain the reservations table structure (ignoring ANSI color codes)
      expect(output).toContain(
        '┌──────┬───────────────────────────────────┬──────────────────────────┐'
      );
      expect(output).toMatch(/│.*Port.*│.*Reason.*│.*Reserved.*│/);
      expect(output).toContain(
        '├──────┼───────────────────────────────────┼──────────────────────────┤'
      );
      expect(output).toContain(
        '└──────┴───────────────────────────────────┴──────────────────────────┘'
      );

      // Should contain the reservation data
      expect(output).toContain('8080');
      expect(output).toContain('Common development server port');
    });

    it('should handle long reservation reasons by truncating them', () => {
      const longReason =
        'This is a very long reason that definitely exceeds the 33 character limit for the table column';

      vi.mocked(listAllocations).mockReturnValue([]);
      vi.mocked(listReservations).mockReturnValue([
        {
          port: 8080,
          reason: longReason,
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Should contain truncated reason with ellipsis (30 chars + "...")
      expect(output).toMatch(/This is a very long reason tha\.\.\./);

      // Should not contain the full long reason
      expect(output).not.toContain(longReason);

      // Table structure should be maintained
      expect(output).toContain(
        '└──────┴───────────────────────────────────┴──────────────────────────┘'
      );
    });

    it('should not show reservations section when no reservations exist', () => {
      // Mock allocations but no reservations
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'myapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);
      vi.mocked(listReservations).mockReturnValue([]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Should NOT contain reservations section
      expect(output).not.toContain('🔒 Reserved');
      expect(output).not.toContain('│ Reason');
    });

    it('should display both allocations and reservations when both exist', () => {
      // Mock both allocations and reservations
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 5434,
          project: 'testapp',
          service: 'db',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);
      vi.mocked(listReservations).mockReturnValue([
        {
          port: 8080,
          reason: 'Development server',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Should contain both sections
      expect(output).toMatch(/🏗️\s+testapp/); // Allocations
      expect(output).toMatch(/🔒 Reserved/); // Reservations

      // Should contain data from both sections
      expect(output).toContain('5434'); // Allocation port
      expect(output).toContain('8080'); // Reservation port
    });
  });

  describe('Port Sorting', () => {
    it('should sort allocated ports by port number ascending within each project', () => {
      // Mock allocations in reverse order to test sorting
      vi.mocked(listAllocations).mockReturnValue([
        {
          port: 6381,
          project: 'myapp',
          service: 'redis',
          type: 'redis',
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
          port: 5434,
          project: 'myapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);
      vi.mocked(listReservations).mockReturnValue([]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Find positions of ports in output
      const port3002Index = output.indexOf('3002');
      const port5434Index = output.indexOf('5434');
      const port6381Index = output.indexOf('6381');

      // Verify they appear in ascending order by port number
      expect(port3002Index).toBeLessThan(port5434Index);
      expect(port5434Index).toBeLessThan(port6381Index);
    });

    it('should sort reserved ports by port number ascending', () => {
      vi.mocked(listAllocations).mockReturnValue([]);
      vi.mocked(listReservations).mockReturnValue([
        {
          port: 9000,
          reason: 'Second reserved port',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
        {
          port: 8080,
          reason: 'First reserved port',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();
      const result = command.execute([], {});

      expect(result.success).toBe(true);

      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');

      // Find positions of ports in output
      const port8080Index = output.indexOf('8080');
      const port9000Index = output.indexOf('9000');

      // Verify they appear in ascending order
      expect(port8080Index).toBeLessThan(port9000Index);
    });
  });

  describe('JSON Output Format', () => {
    it('should include both allocations and reservations in JSON output', () => {
      const mockAllocations = [
        {
          port: 5434,
          project: 'myapp',
          service: 'postgres',
          type: 'postgres',
          allocatedAt: '2023-01-01T12:00:00.000Z',
        },
      ];
      const mockReservations = [
        {
          port: 8080,
          reason: 'Reserved',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ];

      vi.mocked(listAllocations).mockReturnValue(mockAllocations);
      vi.mocked(listReservations).mockReturnValue(mockReservations);

      const command = new ListCommand();
      const result = command.execute([], { json: true });

      expect(result.success).toBe(true);

      // Should output JSON containing both allocations and reservations
      const expectedOutput = JSON.stringify(
        {
          allocations: mockAllocations,
          reservations: mockReservations,
        },
        null,
        2
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(expectedOutput);
    });
  });

  describe('Quiet Mode', () => {
    it('should only output allocation port numbers in quiet mode, not reservations', () => {
      // Mock both allocations and reservations
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
      ]);
      vi.mocked(listReservations).mockReturnValue([
        {
          port: 8080,
          reason: 'Reserved',
          reservedAt: '2023-01-01T12:00:00.000Z',
        },
      ]);

      const command = new ListCommand();
      const result = command.execute([], { quiet: true });

      expect(result.success).toBe(true);

      // Should only output allocation port numbers (sorted by port)
      expect(mockConsoleLog).toHaveBeenCalledWith(3002);
      expect(mockConsoleLog).toHaveBeenCalledWith(5434);

      // Should NOT output reservation port numbers
      expect(mockConsoleLog).not.toHaveBeenCalledWith(8080);

      // Should not contain any table formatting
      const calls = mockConsoleLog.mock.calls.map((call) => call[0]);
      const output = calls.join('\n');
      expect(output).not.toContain('┌');
      expect(output).not.toContain('🔒');
    });
  });
});
