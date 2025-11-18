import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { unreservePort } from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';

export class UnreserveCommand implements Command {
  name = 'unreserve';
  description = 'Remove a port reservation';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [portStr] = args;

      if (!portStr) {
        throw new Error('Port number is required');
      }

      const validatedPort = ValidationService.validatePort(portStr);
      const unreserved = await unreservePort(validatedPort);

      const message = options.quiet
        ? undefined
        : unreserved
          ? `✅ Unreserved port ${validatedPort}`
          : `⚠️  Port ${validatedPort} was not reserved`;

      if (!options.quiet) {
        console.log(message);
      }

      if (options.json) {
        return {
          success: unreserved,
          message,
          data: { unreserved, port: validatedPort },
        };
      }

      return { success: unreserved, message };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
