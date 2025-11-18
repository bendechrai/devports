import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { reservePort } from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';

export class ReserveCommand implements Command {
  name = 'reserve';
  description = 'Reserve a specific port';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [portStr, reason] = args;

      if (!portStr) {
        throw new Error('Port number is required');
      }

      const validatedPort = ValidationService.validatePort(portStr);
      // Sanitize reason string
      const sanitizedReason = ValidationService.sanitizeForDisplay(
        reason ?? 'Reserved',
        100
      );

      await reservePort(validatedPort, sanitizedReason);

      const message = options.quiet
        ? undefined
        : `✅ Reserved port ${validatedPort}: ${sanitizedReason}`;

      if (!options.quiet) {
        console.log(message);
      }

      if (options.json) {
        return {
          success: true,
          message,
          data: {
            reserved: true,
            port: validatedPort,
            reason: sanitizedReason,
          },
        };
      }

      return { success: true, message };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
