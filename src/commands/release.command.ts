import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import {
  releasePort,
  releasePortByNumber,
  listAllocations,
} from '../port-manager.js';
import { ValidationService } from '../services/validation-service.js';
import { ResponseFormatter } from '../services/response-formatter.js';

export class ReleaseCommand implements Command {
  name = 'release';
  description = 'Release allocated port(s)';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      // Handle completion mode
      if (options.completion) {
        return this.handleCompletion(options);
      }

      const [projectOrPort, service] = args;

      if (!projectOrPort) {
        throw new Error('Project name or port number is required');
      }

      // Handle --port flag: release by port number
      if (options.port) {
        const portNum = ValidationService.validatePort(projectOrPort);
        const wasReleased = await releasePortByNumber(portNum);

        if (!wasReleased) {
          throw new Error(`No allocation found for port ${portNum}`);
        }

        const response = ResponseFormatter.portRelease(1, `port ${portNum}`);
        return ResponseFormatter.format(response, options);
      }

      // Handle normal project/service release
      const validatedProject =
        ValidationService.validateProjectName(projectOrPort);

      // Release all ports for project if --all flag or no service specified
      if (options.all || !service) {
        const releasedCount = await releasePort(
          validatedProject,
          undefined,
          true
        );

        if (releasedCount === 0) {
          throw new Error(
            `No allocations found for project "${validatedProject}"`
          );
        }

        const response = ResponseFormatter.portRelease(
          releasedCount,
          `project "${validatedProject}"`
        );
        return ResponseFormatter.format(response, options);
      }

      // Release specific service
      const validatedService = ValidationService.validateServiceName(service);
      const releasedCount = await releasePort(
        validatedProject,
        validatedService,
        false
      );

      if (releasedCount === 0) {
        throw new Error(
          `No allocation found for ${validatedProject}/${validatedService}`
        );
      }

      const response = ResponseFormatter.portRelease(
        releasedCount,
        `${validatedProject}/${validatedService}`
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
        const project = options.project;
        if (project) {
          const allocations = listAllocations({ project: project as string });
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
      default:
        throw new Error(`Invalid completion mode: ${mode}`);
    }
  }
}
