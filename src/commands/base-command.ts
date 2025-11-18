/**
 * Base command interface and utilities for CLI commands
 */

export interface CommandOptions {
  [key: string]: unknown;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Base interface for all commands
 */
export interface Command {
  name: string;
  description: string;
  execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> | CommandResult;
}

/**
 * Helper function for consistent JSON/text output
 */
export function formatOutput(
  result: CommandResult,
  options: CommandOptions
): void {
  if (options.json) {
    console.log(JSON.stringify(result));
  } else if (result.message) {
    console.log(result.message);
  }
}

/**
 * Helper function for error handling
 */
export function handleCommandError(
  error: unknown,
  options: CommandOptions
): void {
  const message = error instanceof Error ? error.message : String(error);

  if (!options.quiet) {
    if (options.json) {
      console.error(
        JSON.stringify({
          success: false,
          error: message,
        })
      );
    } else {
      console.error(`❌ ${message}`);
    }
  }

  process.exit(1);
}
