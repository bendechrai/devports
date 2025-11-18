import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { removeWorktree } from '../worktree.js';
import { ValidationService } from '../services/validation-service.js';
import { sanitizeForDisplay } from '../validation.js';

export class WorktreeRemoveCommand implements Command {
  name = 'remove';
  description = 'Remove a git worktree and release all allocated ports';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [path] = args;

      if (!path) {
        throw new Error('Path to the worktree to remove is required');
      }

      const validatedPath = ValidationService.validateWorktreePath(path);
      const released = await removeWorktree(validatedPath, {
        force: options.force as boolean | undefined,
      });

      const result = { removed: true, portsReleased: released };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return { success: true, data: result };
      }

      console.log(`✅ Removed worktree: ${sanitizeForDisplay(validatedPath)}`);
      console.log(`   Released ${released} port(s)`);

      return { success: true, data: result };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
