import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { listAllocations, listReservations } from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';
import { VALID_PORT_TYPES } from '../types.js';

export class ListCommand implements Command {
  name = 'list';
  description = 'List all port allocations';

  execute(args: string[], options: CommandOptions): CommandResult {
    try {
      // Handle completion mode (no validation needed for shell completion)
      if (options.completion) {
        return this.handleCompletion(options);
      }

      // Validate filter parameters if provided
      const validatedProject = options.project
        ? ValidationService.validateProjectName(options.project as string)
        : undefined;
      const validatedType = options.type
        ? ValidationService.validateServiceType(options.type as string)
        : undefined;

      const allocations = listAllocations({
        project: validatedProject,
        type: validatedType,
      });

      const reservations = listReservations();

      if (options.quiet) {
        // Just output port numbers, one per line (allocations only for quiet mode)
        allocations.forEach((allocation) => {
          console.log(allocation.port);
        });
        return { success: true, data: allocations };
      }

      if (options.json) {
        const result = {
          allocations,
          reservations,
        };
        console.log(JSON.stringify(result, null, 2));
        return { success: true, data: result };
      }

      // Text output
      if (allocations.length === 0 && reservations.length === 0) {
        console.log('No port allocations or reservations found.');
        return {
          success: true,
          message: 'No port allocations or reservations found.',
          data: { allocations: [], reservations: [] },
        };
      }

      console.log('\n');

      // Show allocations grouped by project
      if (allocations.length > 0) {
        // Group by project for better readability
        const grouped = allocations.reduce(
          (acc, alloc) => {
            if (!acc[alloc.project]) {
              acc[alloc.project] = [];
            }
            acc[alloc.project].push(alloc);
            return acc;
          },
          {} as Record<string, typeof allocations>
        );

        Object.keys(grouped)
          .sort()
          .forEach((project, index, projects) => {
            // Project header with styling
            console.log(`\x1b[1m\x1b[36m🏗️  ${project}\x1b[0m`);

            // Table header
            console.log(
              `\x1b[2m┌──────┬──────────────────┬──────────────────┬──────────────────────────┐\x1b[0m`
            );
            console.log(
              `\x1b[2m│\x1b[0m \x1b[1mPort\x1b[0m \x1b[2m│\x1b[0m \x1b[1mService\x1b[0m          \x1b[2m│\x1b[0m \x1b[1mType\x1b[0m             \x1b[2m│\x1b[0m \x1b[1mAllocated\x1b[0m                \x1b[2m│\x1b[0m`
            );
            console.log(
              `\x1b[2m├──────┼──────────────────┼──────────────────┼──────────────────────────┤\x1b[0m`
            );

            // Table rows
            grouped[project]
              .sort((a, b) => a.port - b.port)
              .forEach((allocation) => {
                const port = allocation.port.toString().padEnd(4);
                const service = allocation.service.padEnd(16);
                const type = allocation.type.padEnd(16);
                // Use consistent date format to ensure fixed width (24 chars for allocations)
                const date = new Date(allocation.allocatedAt);
                const timeStr = `${date.toLocaleDateString()}, ${date.toLocaleTimeString(
                  [],
                  {
                    hour12: true,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }
                )}`;
                const time = timeStr.padEnd(24);
                console.log(
                  `\x1b[2m│\x1b[0m \x1b[32m${port}\x1b[0m \x1b[2m│\x1b[0m ${service} \x1b[2m│\x1b[0m \x1b[33m${type}\x1b[0m \x1b[2m│\x1b[0m ${time} \x1b[2m│\x1b[0m`
                );
              });

            // Table footer
            console.log(
              `\x1b[2m└──────┴──────────────────┴──────────────────┴──────────────────────────┘\x1b[0m`
            );

            // Add spacing between projects (except for the last one or before reservations)
            if (index < projects.length - 1) {
              console.log();
            }
          });

        // Add spacing before reservations if both exist
        if (reservations.length > 0) {
          console.log();
        }
      }

      // Show reservations
      if (reservations.length > 0) {
        console.log(`\x1b[1m\x1b[35m🔒 Reserved\x1b[0m`);

        // Table header
        console.log(
          `\x1b[2m┌──────┬───────────────────────────────────┬──────────────────────────┐\x1b[0m`
        );
        console.log(
          `\x1b[2m│\x1b[0m \x1b[1mPort\x1b[0m \x1b[2m│\x1b[0m \x1b[1mReason\x1b[0m                            \x1b[2m│\x1b[0m \x1b[1mReserved\x1b[0m                 \x1b[2m│\x1b[0m`
        );
        console.log(
          `\x1b[2m├──────┼───────────────────────────────────┼──────────────────────────┤\x1b[0m`
        );

        // Table rows
        reservations
          .sort((a, b) => a.port - b.port)
          .forEach((reservation) => {
            const port = reservation.port.toString().padEnd(4);
            // Truncate reason if too long and pad to exactly 33 chars (35 - 2 spaces in template)
            const reason =
              reservation.reason.length > 33
                ? `${reservation.reason.substring(0, 30)}...`
                : reservation.reason.padEnd(33);
            // Use consistent date format to ensure fixed width (24 chars for reservations)
            const date = new Date(reservation.reservedAt);
            const timeStr = `${date.toLocaleDateString()}, ${date.toLocaleTimeString(
              [],
              {
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            )}`;
            const time = timeStr.padEnd(24);
            console.log(
              `\x1b[2m│\x1b[0m \x1b[31m${port}\x1b[0m \x1b[2m│\x1b[0m ${reason} \x1b[2m│\x1b[0m ${time} \x1b[2m│\x1b[0m`
            );
          });

        // Table footer
        console.log(
          `\x1b[2m└──────┴───────────────────────────────────┴──────────────────────────┘\x1b[0m`
        );
      }

      return { success: true, data: { allocations, reservations } };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }

  private handleCompletion(options: CommandOptions): CommandResult {
    const mode = (options.completion as string).toLowerCase();
    const allocations = listAllocations({
      project: options.project as string | undefined,
    });

    switch (mode) {
      case 'projects': {
        const projects = [...new Set(allocations.map((a) => a.project))].sort();
        projects.forEach((p) => console.log(p));
        process.exit(0);
        break;
      }
      case 'services': {
        const services = [...new Set(allocations.map((a) => a.service))].sort();
        services.forEach((s) => console.log(s));
        process.exit(0);
        break;
      }
      case 'types': {
        VALID_PORT_TYPES.forEach((t) => console.log(t));
        process.exit(0);
        break;
      }
      default:
        throw new Error(`Invalid completion mode: ${mode}`);
    }
  }
}
