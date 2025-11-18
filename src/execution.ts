/**
 * Secure command execution utilities
 * Provides safe alternatives to execSync for command injection prevention
 */

import { spawn, SpawnOptions } from 'child_process';
import { statSync } from 'fs';

/**
 * Safe command execution using spawn with argument arrays
 * Prevents shell injection by not using shell interpolation
 */
export async function safeExec(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Safe git worktree add command
 */
export async function safeGitWorktreeAdd(
  path: string,
  branch: string,
  options: SpawnOptions = {}
): Promise<void> {
  const result = await safeExec(
    'git',
    ['worktree', 'add', path, '-b', branch],
    {
      ...options,
      stdio: 'inherit',
    }
  );

  if (result.exitCode !== 0) {
    throw new Error(
      `Git worktree add failed: ${result.stderr || 'Unknown error'}`
    );
  }
}

/**
 * Safe git worktree remove command
 */
export async function safeGitWorktreeRemove(
  path: string,
  force: boolean = false,
  options: SpawnOptions = {}
): Promise<void> {
  const args = ['worktree', 'remove'];
  if (force) {
    args.push('--force');
  }
  args.push(path);

  const result = await safeExec('git', args, {
    ...options,
    stdio: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Git worktree remove failed: ${result.stderr || 'Unknown error'}`
    );
  }
}

/**
 * Safe script execution with controlled environment
 */
export async function safeScriptExecution(
  scriptPath: string,
  env: Record<string, string> = {},
  options: SpawnOptions = {}
): Promise<void> {
  // First make the script executable
  await safeExec('chmod', ['+x', scriptPath]);

  // Then execute it with controlled environment
  const result = await safeExec(scriptPath, [], {
    ...options,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Script execution failed: ${result.stderr || 'Unknown error'}`
    );
  }
}

/**
 * Validate that a file is safe to execute as a script
 */
export function validateExecutableScript(scriptPath: string): void {
  try {
    const stats = statSync(scriptPath);

    if (!stats.isFile()) {
      throw new Error('Script path is not a file');
    }

    // Check if executable on Unix-like systems
    if (process.platform !== 'win32') {
      const mode = stats.mode;
      if (!(mode & parseInt('0100', 8))) {
        throw new Error('Script is not executable');
      }
    }
  } catch (error) {
    throw new Error(`Script validation failed: ${(error as Error).message}`);
  }
}
