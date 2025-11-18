import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { allocatePort, listAllocations } from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';
import { ResponseFormatter } from '../services/response-formatter.js';
import { VALID_PORT_TYPES } from '../types.js';

export class AllocateCommand implements Command {
  name = 'allocate';
  description = 'Allocate a port for a project/service';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      // Handle completion mode
      if (options.completion) {
        return this.handleCompletion(options);
      }

      const [project, service] = args;

      if (!project) {
        throw new Error('Project name is required');
      }

      if (!service) {
        throw new Error('Service name is required');
      }

      if (!options.type) {
        throw new Error(
          'Service type is required. Use --type to specify one of: postgres, mysql, redis, api, app, custom'
        );
      }

      // Validate inputs
      const validatedProject = ValidationService.validateProjectName(project);
      const validatedService = ValidationService.validateServiceName(service);
      const validatedType = ValidationService.validateServiceType(
        options.type as string
      );

      const port = await allocatePort(
        validatedProject,
        validatedService,
        validatedType
      );

      // Handle quiet mode first
      if (options.quiet) {
        return ResponseFormatter.quiet(port, { port });
      }

      // Use centralized formatter for all output patterns
      const response = ResponseFormatter.portAllocation(
        port,
        validatedProject,
        validatedService,
        validatedType
      );
      return ResponseFormatter.format(response, options);
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }

  private handleCompletion(options: CommandOptions): CommandResult {
    const mode = (options.completion as string).toLowerCase();

    switch (mode) {
      case 'projects': {
        const allocations = listAllocations();
        const projects = [...new Set(allocations.map((a) => a.project))].sort();
        projects.forEach((p) => console.log(p));
        process.exit(0);
        break;
      }
      case 'services': {
        // For services, we need a specific project - check if one was provided
        const project = options.project as string;
        if (project) {
          const allocations = listAllocations({ project });
          const services = [
            ...new Set(allocations.map((a) => a.service)),
          ].sort();
          services.forEach((s) => console.log(s));
        } else {
          // No project specified, return all services
          const allocations = listAllocations();
          const services = [
            ...new Set(allocations.map((a) => a.service)),
          ].sort();
          services.forEach((s) => console.log(s));
        }
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
