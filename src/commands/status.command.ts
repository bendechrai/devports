import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { getStatus } from '../port-manager.js';

export class StatusCommand implements Command {
  name = 'status';
  description = 'Show available ports by type';

  execute(args: string[], options: CommandOptions): CommandResult {
    try {
      const status = getStatus();

      if (options.json) {
        console.log(JSON.stringify(status.types, null, 2));
        return { success: true, data: status.types };
      }

      if (options.quiet) {
        // Output format: type:port (one per line)
        for (const [type, stats] of Object.entries(status.types)) {
          if (stats.next) {
            console.log(`${type}:${stats.next}`);
          }
        }
        return { success: true, data: status.types };
      }

      console.log('\nPort Status:\n');

      for (const [type, stats] of Object.entries(status.types)) {
        console.log(
          `${type.padEnd(12)}: ${stats.used} used, ${stats.available} available`
        );
        if (stats.next) {
          console.log(`              Next available: ${stats.next}`);
        } else {
          console.log(`              ⚠️  No ports available`);
        }
      }

      console.log('');
      return { success: true, data: status.types };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
