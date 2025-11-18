import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { setupCurrentDirectory } from '../setup.js';
import { ValidationService } from '../services/validation-service.js';

export class SetupCommand implements Command {
  name = 'setup';
  description =
    'Set up the current directory with port allocation (main clone only)';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      // Validate inputs
      let validatedServices;
      if (options.services) {
        const serviceStrings = (options.services as string)
          .split(',')
          .map((s: string) => s.trim());
        const validatedServiceList =
          ValidationService.validateServices(serviceStrings);
        validatedServices = validatedServiceList.map(
          (s) => `${s.service}:${s.type}`
        );
      }

      const validatedTemplate = options.template
        ? ValidationService.validateTemplatePath(options.template as string)
        : undefined;
      const validatedPostHook = options.postHook
        ? ValidationService.validateScriptPath(options.postHook as string)
        : undefined;

      const result = await setupCurrentDirectory({
        template: validatedTemplate,
        services: validatedServices,
        force: options.force as boolean | undefined,
        skipRender: options.skipRender as boolean | undefined,
        postHook: validatedPostHook,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return { success: true, data: result };
      }

      return { success: true, data: result };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
