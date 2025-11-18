import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { createWorktree } from '../worktree.js';
import { ValidationService } from '../services/validation-service.js';
import {
  validateServices,
  validateScriptPath,
  ValidationError,
  sanitizeForDisplay,
} from '../validation.js';

export class WorktreeAddCommand implements Command {
  name = 'add';
  description = 'Create a git worktree with automatic port allocation';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [path] = args;

      if (!path) {
        throw new ValidationError('Path for the new worktree is required');
      }

      if (!options.branch) {
        throw new ValidationError('Branch name required (use -b or --branch)');
      }

      // Validate inputs
      const validatedPath = ValidationService.validateWorktreePath(path);
      const validatedBranch = ValidationService.validateBranchName(
        options.branch as string
      );

      let validatedServices;
      if (options.services) {
        const serviceStrings = (options.services as string)
          .split(',')
          .map((s: string) => s.trim());
        const validatedServiceList = validateServices(serviceStrings);
        validatedServices = validatedServiceList.map(
          (s) => `${s.service}:${s.type}`
        );
      }

      const validatedEnvFile = options.envFile
        ? ValidationService.validateOutputPath(options.envFile as string)
        : (options.envFile as string | undefined);
      const validatedTemplate = options.template
        ? ValidationService.validateTemplatePath(options.template as string)
        : undefined;
      const validatedPostHook = options.postHook
        ? validateScriptPath(options.postHook as string)
        : undefined;

      const { worktreePath, ports } = await createWorktree(
        validatedPath,
        validatedBranch,
        {
          envFile:
            (options.env as boolean | undefined) === false
              ? null
              : validatedEnvFile,
          services: validatedServices,
          template: validatedTemplate,
          postHook: validatedPostHook,
        }
      );

      const result = { worktreePath, ports };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return { success: true, data: result };
      }

      console.log(`✅ Created worktree: ${sanitizeForDisplay(worktreePath)}`);
      console.log(`   Branch: ${sanitizeForDisplay(validatedBranch)}`);
      console.log('\n📌 Allocated ports:');
      for (const [service, port] of Object.entries(ports)) {
        console.log(`   ${sanitizeForDisplay(service)}: ${port}`);
      }
      if (options.env !== false) {
        console.log(
          `\n📝 Created ${sanitizeForDisplay((validatedEnvFile as string) ?? '.env')} with port configuration`
        );
      }
      console.log(
        `\n💡 To remove: devports worktree remove ${sanitizeForDisplay(validatedPath)}`
      );

      return { success: true, data: result };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
