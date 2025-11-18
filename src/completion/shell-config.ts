/**
 * Shell configuration management for completion installation
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

/**
 * Check if completion system is initialized for a shell
 */
export function isCompletionSystemInitialized(shell: string): boolean {
  try {
    const { hasSetup } = hasCompletionSetupInConfig(shell);
    return hasSetup;
  } catch {
    return false;
  }
}

/**
 * Check if completion is installed for a shell
 */
export function isCompletionInstalled(shell: string): boolean {
  try {
    const home = homedir();
    let completionPath: string;

    switch (shell.toLowerCase()) {
      case 'zsh':
        completionPath = join(home, '.zsh', 'completions', '_devports');
        break;
      case 'bash':
        completionPath = join(home, '.bash_completion.d', 'devports');
        break;
      default:
        return false;
    }

    return existsSync(completionPath);
  } catch {
    return false;
  }
}

/**
 * Get the configuration file path for a shell
 */
function getShellConfigFile(shell: string): string {
  const home = homedir();

  switch (shell) {
    case 'zsh': {
      // Try common zsh config files
      const zshConfigs = ['.zshrc', '.zsh_profile', '.profile'];
      for (const config of zshConfigs) {
        const path = join(home, config);
        if (existsSync(path)) {
          return path;
        }
      }
      // Default to .zshrc if none exist
      return join(home, '.zshrc');
    }

    case 'bash': {
      // Try common bash config files
      const bashConfigs = ['.bashrc', '.bash_profile', '.profile'];
      for (const config of bashConfigs) {
        const path = join(home, config);
        if (existsSync(path)) {
          return path;
        }
      }
      // Default to .bashrc if none exist
      return join(home, '.bashrc');
    }

    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }
}

/**
 * Check if completion setup exists in shell config
 */
function hasCompletionSetupInConfig(shell: string): {
  hasSetup: boolean;
  configFile: string;
} {
  try {
    const configFile = getShellConfigFile(shell);

    if (!existsSync(configFile)) {
      return { hasSetup: false, configFile };
    }

    const content = readFileSync(configFile, 'utf-8');
    const hasSetup =
      content.includes('# devports completion setup') ||
      content.includes('eval "$(devports completion');

    return { hasSetup, configFile };
  } catch {
    return { hasSetup: false, configFile: '' };
  }
}

/**
 * Generate shell configuration commands for completion setup
 */
function generateShellConfigCommands(shell: string): string[] {
  let commands: string[];

  switch (shell) {
    case 'zsh':
      commands = [
        '',
        '# devports completion setup',
        'autoload -U compinit && compinit',
        `eval "$(devports completion ${shell})"`,
        '',
      ];
      break;
    case 'bash':
      commands = [
        '',
        '# devports completion setup',
        `eval "$(devports completion ${shell})"`,
        '',
      ];
      break;
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }

  return commands;
}

/**
 * Setup completion system for a shell
 */
export function setupCompletionSystem(shell: string): {
  success: boolean;
  message: string;
  configFile: string;
} {
  try {
    const configFile = getShellConfigFile(shell);
    const { hasSetup } = hasCompletionSetupInConfig(shell);

    if (hasSetup) {
      return {
        success: true,
        message: `Completion is already configured in ${configFile}`,
        configFile,
      };
    }

    // Ensure the config file exists
    if (!existsSync(configFile)) {
      const configDir = join(configFile, '..');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      writeFileSync(configFile, '');
    }

    // Read existing content
    let content = '';
    try {
      content = readFileSync(configFile, 'utf-8');
    } catch {
      content = '';
    }

    // Generate completion setup commands
    const commands = generateShellConfigCommands(shell);
    const newContent = content + commands.join('\n');

    // Write updated content
    writeFileSync(configFile, newContent);

    // Try to reload shell configuration
    try {
      if (shell === 'zsh') {
        execSync(`source ${configFile}`, { stdio: 'pipe' });
      } else if (shell === 'bash') {
        execSync(`source ${configFile}`, { stdio: 'pipe' });
      }
    } catch {
      // Reloading may fail, but that's okay - user can restart shell
    }

    return {
      success: true,
      message: `Completion setup added to ${configFile}. Restart your shell or run: source ${configFile}`,
      configFile,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to setup completion: ${errorMessage}`,
      configFile: '',
    };
  }
}

/**
 * Uninstall completion from shell configuration
 */
export function uninstallCompletion(shell: string): {
  success: boolean;
  message: string;
} {
  try {
    const configFile = getShellConfigFile(shell);

    if (!existsSync(configFile)) {
      return {
        success: true,
        message: 'No configuration file found, completion was not installed',
      };
    }

    const content = readFileSync(configFile, 'utf-8');
    const lines = content.split('\n');

    // Remove lines related to devports completion
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      return !(
        trimmed.includes('# devports completion setup') ||
        trimmed.includes('eval "$(devports completion') ||
        trimmed.includes('autoload -U compinit && compinit') ||
        (trimmed === '' &&
          lines[lines.indexOf(line) - 1]?.includes('devports completion'))
      );
    });

    // Remove duplicate empty lines
    const cleanedLines = [];
    let prevEmpty = false;
    for (const line of filteredLines) {
      if (line.trim() === '') {
        if (!prevEmpty) {
          cleanedLines.push(line);
        }
        prevEmpty = true;
      } else {
        cleanedLines.push(line);
        prevEmpty = false;
      }
    }

    if (cleanedLines.length === filteredLines.length) {
      return {
        success: true,
        message: 'No devports completion found in configuration',
      };
    }

    writeFileSync(configFile, cleanedLines.join('\n'));

    return {
      success: true,
      message: `Removed devports completion from ${configFile}. Restart your shell to apply changes.`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to uninstall completion: ${errorMessage}`,
    };
  }
}
