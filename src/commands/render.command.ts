import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { renderFile } from '../render.js';
import { ValidationService } from '../services/validation-service.js';
import { sanitizeForDisplay } from '../validation.js';

export class RenderCommand implements Command {
  name = 'render';
  description = 'Render a template file with allocated ports';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [file] = args;

      if (!file) {
        throw new Error('Template file to process is required');
      }

      const validatedFile = ValidationService.validateTemplatePath(file);
      const validatedProject = options.project
        ? ValidationService.validateProjectName(options.project as string)
        : undefined;
      const validatedOutput = options.output
        ? ValidationService.validateOutputPath(options.output as string)
        : undefined;

      const result = await renderFile(validatedFile, {
        projectName: validatedProject,
        outputFile: validatedOutput,
      });

      const data = {
        projectName: result.projectName,
        allocatedPorts: result.allocatedPorts,
        outputFile: validatedOutput ?? 'stdout',
      };

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return { success: true, data };
      }

      if (!validatedOutput) {
        // Output to stdout if no output file specified
        console.log(result.content);
        return { success: true, data: { ...data, content: result.content } };
      }

      console.log(
        `✅ Rendered ${sanitizeForDisplay(validatedFile)} to ${sanitizeForDisplay(validatedOutput)}`
      );
      console.log(`📍 Project: ${sanitizeForDisplay(result.projectName)}`);
      const portEntries = Object.entries(result.allocatedPorts);
      if (portEntries.length > 0) {
        console.log(
          `🔌 Allocated ports: ${portEntries.map(([service, port]) => `${sanitizeForDisplay(service)}:${port}`).join(', ')}`
        );
      }

      return { success: true, data };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
