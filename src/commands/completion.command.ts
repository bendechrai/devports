import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import {
  generateCompletionScript,
  installCompletionWithSetup,
  uninstallCompletion,
  isCompletionInstalled,
} from '../completion/index.js';
import { ValidationError } from '../services/validation-service.js';

export class CompletionCommand implements Command {
  name = 'completion';
  description = 'Generate shell completion script';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      const [shell = 'zsh'] = args;
      const validShells = ['bash', 'zsh'];
      const normalizedShell = shell.toLowerCase().trim();

      if (!validShells.includes(normalizedShell)) {
        throw new ValidationError(
          `Invalid shell type. Must be one of: ${validShells.join(', ')}`
        );
      }

      if (options.check) {
        const installed = isCompletionInstalled(normalizedShell);

        const result = { shell: normalizedShell, installed };

        if (options.json) {
          console.log(JSON.stringify(result));
          return { success: installed, data: result };
        }

        const status = installed ? '✅ installed' : '❌ not installed';
        console.log(`Shell completion for ${normalizedShell}: ${status}`);

        if (!installed) {
          console.log(
            `\nTo install: devports completion ${normalizedShell} --install`
          );
        }

        return { success: installed, data: result };
      }

      if (options.test) {
        // Test completion in a fresh shell
        try {
          const { execSync } = await import('child_process');
          const configFile =
            normalizedShell === 'zsh' ? '~/.zshrc' : '~/.bashrc';
          const testCommand =
            normalizedShell === 'zsh'
              ? `source ${configFile} && type _devports >/dev/null 2>&1`
              : `source ${configFile} && type _devports_completion >/dev/null 2>&1`;

          execSync(`${normalizedShell} -c '${testCommand}'`, { stdio: 'pipe' });

          const result = {
            shell: normalizedShell,
            completionWorks: true,
            message: 'Completion system is working correctly',
          };

          if (options.json) {
            console.log(JSON.stringify(result));
            return { success: true, data: result };
          }

          console.log(`✅ ${normalizedShell} completion is working correctly!`);
          console.log(`Try these tests in a new terminal:`);
          console.log(`   devports <TAB><TAB>`);
          console.log(`   devports al<TAB>`);
          console.log(`   devports release -a <TAB>`);

          return { success: true, data: result };
        } catch {
          const result = {
            shell: normalizedShell,
            completionWorks: false,
            message:
              'Completion system is not working. Try running --install first.',
          };

          if (options.json) {
            console.log(JSON.stringify(result));
            return { success: false, data: result };
          }

          console.log(`❌ ${normalizedShell} completion is not working.`);
          console.log(`Run: devports completion ${normalizedShell} --install`);

          return { success: false, data: result };
        }
      }

      if (options.install) {
        const result = installCompletionWithSetup(normalizedShell);

        const data = {
          success: result.success,
          shell: normalizedShell,
          message: result.message,
          configFile: result.configFile,
        };

        if (options.json) {
          console.log(JSON.stringify(data));
          return { success: result.success, data };
        }

        console.log(result.message);
        return { success: result.success, data };
      } else if (options.uninstall) {
        const result = uninstallCompletion(normalizedShell);

        const data = {
          uninstalled: result.success,
          shell: normalizedShell,
          message: result.message,
        };

        if (options.json) {
          console.log(JSON.stringify(data));
          return { success: result.success, data };
        }

        console.log(result.message);
        return { success: result.success, data };
      } else {
        // Output completion script to stdout
        const script = generateCompletionScript(normalizedShell);

        const data = { shell: normalizedShell, script };

        if (options.json) {
          console.log(JSON.stringify(data));
          return { success: true, data };
        }

        console.log(script);
        return { success: true, data };
      }
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
