#!/usr/bin/env node

/**
 * Secure CLI wrapper with comprehensive input validation
 * This file provides security-hardened versions of all CLI commands
 */

import { Command, OptionValues } from 'commander';
import {
  allocatePort,
  releasePort,
  releasePortByNumber,
  listAllocations,
  getStatus,
  reservePort,
  unreservePort,
} from './port-manager.js';
import { createWorktree, removeWorktree } from './worktree.js';
import { renderFile } from './render.js';
import {
  updateGitignore,
  cleanGitignore,
  previewGitignore,
} from './gitignore.js';
import { setupCurrentDirectory } from './setup.js';
import {
  ValidationError,
  validateProjectName,
  validateServiceName,
  validateServiceType,
  validatePort,
  validateBranchName,
  validateWorktreePath,
  validateScriptPath,
  validateServices,
  validateTemplatePath,
  validateOutputPath,
  sanitizeForDisplay,
} from './validation.js';
import {
  generateCompletionScript,
  installCompletionWithSetup,
  uninstallCompletion,
  isCompletionInstalled,
  isCompletionSystemInitialized,
} from './completion/index.js';

const program = new Command();

const ASCII_HEADER = `
 ██████╗ ███████╗██╗   ██╗██████╗  ██████╗ ██████╗ ████████╗███████╗
 ██╔══██╗██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝
 ██║  ██║█████╗  ██║   ██║██████╔╝██║   ██║██████╔╝   ██║   ███████╗
 ██║  ██║██╔══╝  ╚██╗ ██╔╝██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║
 ██████╔╝███████╗ ╚████╔╝ ██║     ╚██████╔╝██║  ██║   ██║   ███████║
 ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝

 Port allocation manager for multi-project development
`;

// Override process.stdout.write and process.stderr.write to add extra line after output
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// Track if we should add blank lines (disabled for quiet/json modes)
let shouldAddBlankLines = true;

function setShouldAddBlankLines(value: boolean) {
  shouldAddBlankLines = value;
}

function addBlankLineAfterOutput(output: string): string {
  if (!shouldAddBlankLines) {
    return output;
  }

  // Check if this looks like help output by looking for common help patterns
  if (
    output.includes('Usage:') &&
    (output.includes('Options:') || output.includes('Commands:'))
  ) {
    return `${output}\n`;
  }

  // Check if this looks like command completion (ends with success/error emoji and doesn't already end with newline)
  if (
    (output.includes('✅') || output.includes('❌')) &&
    !output.endsWith('\n\n')
  ) {
    return `${output}\n`;
  }

  return output;
}

process.stdout.write = ((
  chunk: string | Uint8Array,
  encoding?: BufferEncoding,
  callback?: (error?: Error | null) => void
): boolean => {
  if (typeof chunk === 'string') {
    chunk = addBlankLineAfterOutput(chunk);
  }
  return originalStdoutWrite(chunk, encoding, callback);
}) as typeof process.stdout.write;

process.stderr.write = ((
  chunk: string | Uint8Array,
  encoding?: BufferEncoding,
  callback?: (error?: Error | null) => void
): boolean => {
  if (typeof chunk === 'string') {
    chunk = addBlankLineAfterOutput(chunk);
  }
  return originalStderrWrite(chunk, encoding, callback);
}) as typeof process.stderr.write;

program
  .name('devports')
  .description('Port allocation manager for multi-project development')
  .version('0.1.0')
  .addHelpText('before', ASCII_HEADER);

// Setup command
const setupCmd = new SetupCommand();
program
  .command('setup')
  .description(setupCmd.description)
  .option(
    '--template <file>',
    'Template file to use (default: .env.devports if exists)'
  )
  .option(
    '--services <services>',
    'Services to allocate (comma-separated, e.g., postgres:postgres,api:api)'
  )
  .option('--force', 'Overwrite existing .env file (creates .env.backup)')
  .option('--skip-render', 'Skip auto-rendering of *.devports files')
  .option('--post-hook <script>', 'Run script after setup (passed env vars)')
  .option('--json', 'Output as JSON')
  .action(async (options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }

    // Show ASCII header for setup command (but not if --json is used)
    if (!options.json) {
      console.log(ASCII_HEADER);
    }
    const result = await setupCmd.execute([], options);
    process.exit(result.success ? 0 : 1);
  });

// Worktree command group
const worktreeAddCmd = new WorktreeAddCommand();
const worktreeRemoveCmd = new WorktreeRemoveCommand();
const worktree = program
  .command('worktree')
  .description('Git worktree integration with automatic port allocation');

// Worktree add
worktree
  .command('add')
  .description(worktreeAddCmd.description)
  .argument('<path>', 'Path for the new worktree')
  .option('-b, --branch <branch>', 'Create and checkout a new branch')
  .option('--no-env', 'Skip .env file creation')
  .option('--env-file <file>', 'Custom .env file name', '.env')
  .option(
    '--services <services>',
    'Services to allocate (comma-separated, e.g., postgres:postgres,api:api)'
  )
  .option(
    '--template <file>',
    'Use template file for .env generation (default: .env.devports if exists)'
  )
  .option(
    '--post-hook <script>',
    'Run script after worktree creation (passed env vars)'
  )
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await worktreeAddCmd.execute([path], options);
    process.exit(result.success ? 0 : 1);
  });

// Worktree remove
worktree
  .command('remove')
  .description(worktreeRemoveCmd.description)
  .argument('<path>', 'Path to the worktree to remove')
  .option('-f, --force', 'Force removal even if worktree is dirty')
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await worktreeRemoveCmd.execute([path], options);
    process.exit(result.success ? 0 : 1);
  });

// Allocate command
import { AllocateCommand } from './commands/allocate.command.js';
import { ReleaseCommand } from './commands/release.command.js';
import { ListCommand } from './commands/list.command.js';
import { StatusCommand } from './commands/status.command.js';
import { ReserveCommand } from './commands/reserve.command.js';
import { UnreserveCommand } from './commands/unreserve.command.js';
import { CheckCommand } from './commands/check.command.js';
import { InfoCommand } from './commands/info.command.js';
import { SetupCommand } from './commands/setup.command.js';
import { WorktreeAddCommand } from './commands/worktree-add.command.js';
import { WorktreeRemoveCommand } from './commands/worktree-remove.command.js';
import { RenderCommand } from './commands/render.command.js';
import { GitignoreCommand } from './commands/gitignore.command.js';
import { CompletionCommand } from './commands/completion.command.js';
const allocateCmd = new AllocateCommand();
program
  .command('allocate')
  .description(allocateCmd.description)
  .argument('[project]', 'Project name')
  .argument('[service]', 'Service name (e.g., postgres, api)')
  .option(
    '-t, --type <type>',
    'Service type (postgres, mysql, redis, api, app, custom)'
  )
  .option('-q, --quiet', 'Only output the port number (for scripting)')
  .option('--json', 'Output result as JSON')
  .option(
    '--completion <mode>',
    'Output for shell completion: projects, services, types'
  )
  .action(async (project: string, service: string, options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    await allocateCmd.execute([project, service], options);
    process.exit(0);
  });

// Release command
const releaseCmd = new ReleaseCommand();
program
  .command('release')
  .description(releaseCmd.description)
  .argument('[project]', 'Project name (or port number with --port)')
  .argument('[service]', 'Service name (optional if using --all or --port)')
  .option('-a, --all', 'Release all ports for this project')
  .option('-p, --port', 'First argument is a port number to release')
  .option('-q, --quiet', 'Suppress output (exit code indicates success)')
  .option('--json', 'Output result as JSON')
  .option(
    '--completion <mode>',
    'Output for shell completion: projects, services'
  )
  .option(
    '--project <name>',
    'Project name for completion filtering (internal use)'
  )
  .action(
    async (
      projectOrPort: string,
      service: string | undefined,
      options: OptionValues
    ) => {
      // Disable blank lines for quiet or json mode
      if (options.quiet || options.json) {
        setShouldAddBlankLines(false);
      }
      const args = service ? [projectOrPort, service] : [projectOrPort];
      const result = await releaseCmd.execute(args, options);
      process.exit(result.success ? 0 : 1);
    }
  );

// List command
const listCmd = new ListCommand();
program
  .command('list')
  .description(listCmd.description)
  .option('-p, --project <project>', 'Filter by project')
  .option('-t, --type <type>', 'Filter by service type')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Minimal output (just port numbers, one per line)')
  .option(
    '--completion <mode>',
    'Output for shell completion: projects, services, types'
  )
  .action((options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    const result = listCmd.execute([], options);
    if (!result.success) {
      process.exit(1);
    }
  });

// Status command
const statusCmd = new StatusCommand();
program
  .command('status')
  .description(statusCmd.description)
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Minimal output (just next available ports)')
  .action((options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    const result = statusCmd.execute([], options);
    process.exit(result.success ? 0 : 1);
  });

// Reserve command
const reserveCmd = new ReserveCommand();
program
  .command('reserve')
  .description(reserveCmd.description)
  .argument('<port>', 'Port number to reserve')
  .argument('[reason]', 'Reason for reservation', 'Reserved')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress output')
  .action(async (portStr: string, reason: string, options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await reserveCmd.execute([portStr, reason], options);
    process.exit(result.success ? 0 : 1);
  });

// Unreserve command
const unreserveCmd = new UnreserveCommand();
program
  .command('unreserve')
  .description(unreserveCmd.description)
  .argument('<port>', 'Port number to unreserve')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Suppress output')
  .action(async (portStr: string, options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await unreserveCmd.execute([portStr], options);
    process.exit(result.success ? 0 : 1);
  });

// Check command
const checkCmd = new CheckCommand();
program
  .command('check')
  .description(checkCmd.description)
  .argument('<port>', 'Port number to check')
  .option('--json', 'Output as JSON')
  .option('-q, --quiet', 'Silent mode (exit code only: 0=available, 1=in use)')
  .action((portStr: string, options: OptionValues) => {
    // Disable blank lines for quiet or json mode
    if (options.quiet || options.json) {
      setShouldAddBlankLines(false);
    }
    const result = checkCmd.execute([portStr], options);
    process.exit(result.success ? 0 : 1);
  });

// Info command
const infoCmd = new InfoCommand();
program
  .command('info')
  .description(infoCmd.description)
  .option('--json', 'Output as JSON')
  .action(async (options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await infoCmd.execute([], options);
    process.exit(result.success ? 0 : 1);
  });

// Render command
const renderCmd = new RenderCommand();
program
  .command('render')
  .description(renderCmd.description)
  .argument('<file>', 'Template file to process')
  .option(
    '-p, --project <n>',
    'Project name (overrides DEVPORTS_PROJECT_NAME in template)'
  )
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .option('--json', 'Output allocation info as JSON')
  .action(async (file: string, options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await renderCmd.execute([file], options);
    process.exit(result.success ? 0 : 1);
  });

// Gitignore command
const gitignoreCmd = new GitignoreCommand();
program
  .command('gitignore')
  .description(gitignoreCmd.description)
  .option('--preview', 'Show what would be added without making changes')
  .option('--clean', 'Remove stale devports entries from .gitignore')
  .option('--json', 'Output as JSON')
  .action(async (options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await gitignoreCmd.execute([], options);
    process.exit(result.success ? 0 : 1);
  });

// Completion command
const completionCmd = new CompletionCommand();
program
  .command('completion')
  .description(completionCmd.description)
  .argument('[shell]', 'Shell type (bash, zsh)', 'zsh')
  .option('-i, --install', 'Install completion script to user directory')
  .option('-u, --uninstall', 'Remove completion script and shell config')
  .option('--check', 'Check if completion is already installed')
  .option('--test', 'Test if completion works in a fresh shell')
  .option('--json', 'Output as JSON')
  .action(async (shell: string, options: OptionValues) => {
    // Disable blank lines for json mode
    if (options.json) {
      setShouldAddBlankLines(false);
    }
    const result = await completionCmd.execute([shell], options);
    process.exit(result.success ? 0 : 1);
  });

program.parse();
