import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { listAllocations } from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';

export class CheckCommand implements Command {
  name = 'check';
  description = 'Check if a port is available (non-destructive)';

  execute(args: string[], options: CommandOptions): CommandResult {
    try {
      const [portStr] = args;

      if (!portStr) {
        throw new Error('Port number is required');
      }

      const validatedPort = ValidationService.validatePort(portStr);
      const allocations = listAllocations();
      const allocated = allocations.find((a) => a.port === validatedPort);
      const available = !allocated;

      const message = options.quiet
        ? undefined
        : available
          ? `✅ Port ${validatedPort} is available`
          : `❌ Port ${validatedPort} is allocated to ${ValidationService.sanitizeForDisplay(allocated?.project ?? 'unknown')}/${ValidationService.sanitizeForDisplay(allocated?.service ?? 'unknown')}`;

      if (!options.quiet) {
        console.log(message);
      }

      if (options.json) {
        return {
          success: available,
          message,
          data: {
            port: validatedPort,
            available,
            allocation: allocated ?? null,
          },
        };
      }

      return { success: available, message };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
