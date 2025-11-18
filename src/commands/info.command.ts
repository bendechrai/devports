import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import { listAllocations, getStatus } from '../port-manager.js';

export class InfoCommand implements Command {
  name = 'info';
  description = 'Show devports configuration and registry information';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      const allocations = listAllocations();
      const status = getStatus();

      const info = {
        configPath: '~/.config/devports/config.json',
        registryPath: config.registryPath,
        totalAllocations: allocations.length,
        portRanges: config.ranges,
        stats: status.types,
      };

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return { success: true, data: info };
      }

      console.log('\ndevports Configuration:\n');
      console.log(`Config:      ~/.config/devports/config.json`);
      console.log(`Registry:    ${config.registryPath}`);
      console.log(`Allocations: ${allocations.length} ports in use`);
      console.log('\nPort Ranges:');
      for (const [type, range] of Object.entries(config.ranges)) {
        console.log(`  ${type.padEnd(10)}: ${range.start}-${range.end}`);
      }
      console.log('');

      return { success: true, data: info };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
