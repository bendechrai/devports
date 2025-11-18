/**
 * Modular completion system for devports CLI
 * Coordinates shell templates, data providers, and configuration management
 */

import { generateZshCompletion } from './zsh-completion-template.js';
import { generateBashCompletion } from './bash-completion-template.js';
import {
  getProjectsForCompletion,
  getServicesForCompletion,
  getServiceTypesForCompletion,
} from './completion-data.js';
import {
  isCompletionSystemInitialized,
  isCompletionInstalled,
  setupCompletionSystem,
  uninstallCompletion,
} from './shell-config.js';

export interface CompletionOptions {
  install?: boolean;
  shell?: string;
}

/**
 * Generate completion script for specified shell
 */
export function generateCompletionScript(shell: string): string {
  switch (shell.toLowerCase()) {
    case 'zsh':
      return generateZshCompletion();
    case 'bash':
      return generateBashCompletion();
    default:
      throw new Error(
        `Unsupported shell: ${shell}. Supported shells: bash, zsh`
      );
  }
}

/**
 * Install completion with automatic setup for shell configuration
 */
export function installCompletionWithSetup(shell: string): {
  success: boolean;
  message: string;
  configFile: string;
} {
  return setupCompletionSystem(shell);
}

// Re-export completion functions for backward compatibility
export {
  isCompletionInstalled,
  getProjectsForCompletion,
  getServicesForCompletion,
  getServiceTypesForCompletion,
  isCompletionSystemInitialized,
  setupCompletionSystem,
  uninstallCompletion,
};
