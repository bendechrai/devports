/**
 * Command registry - exports all available commands
 */

import { Command } from './base-command.js';
import { AllocateCommand } from './allocate.command.js';
import { ReleaseCommand } from './release.command.js';
import { ListCommand } from './list.command.js';
import { StatusCommand } from './status.command.js';
import { ReserveCommand } from './reserve.command.js';
import { UnreserveCommand } from './unreserve.command.js';
import { CheckCommand } from './check.command.js';
import { InfoCommand } from './info.command.js';
import { SetupCommand } from './setup.command.js';
import { WorktreeAddCommand } from './worktree-add.command.js';
import { WorktreeRemoveCommand } from './worktree-remove.command.js';
import { RenderCommand } from './render.command.js';
import { GitignoreCommand } from './gitignore.command.js';
import { CompletionCommand } from './completion.command.js';

// Registry of all available commands
export const commands = new Map<string, Command>([
  ['allocate', new AllocateCommand()],
  ['release', new ReleaseCommand()],
  ['list', new ListCommand()],
  ['status', new StatusCommand()],
  ['reserve', new ReserveCommand()],
  ['unreserve', new UnreserveCommand()],
  ['check', new CheckCommand()],
  ['info', new InfoCommand()],
  ['setup', new SetupCommand()],
  ['worktree-add', new WorktreeAddCommand()],
  ['worktree-remove', new WorktreeRemoveCommand()],
  ['render', new RenderCommand()],
  ['gitignore', new GitignoreCommand()],
  ['completion', new CompletionCommand()],
]);

export { Command, CommandOptions, CommandResult } from './base-command.js';
