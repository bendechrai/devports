import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

export interface GitignoreResult {
  added: string[];
  existing: string[];
  devportsFiles: string[];
}

/**
 * Find all *.devports files and add corresponding entries to .gitignore
 */
export async function updateGitignore(
  options: { dryRun?: boolean } = {}
): Promise<GitignoreResult> {
  // Find all *.devports files
  const devportsFiles = await glob('**/*.devports', {
    ignore: ['node_modules/**', '.git/**'],
  });

  if (devportsFiles.length === 0) {
    return {
      added: [],
      existing: [],
      devportsFiles: [],
    };
  }

  // Generate target filenames (remove .devports extension)
  const targetFiles = devportsFiles.map((file) =>
    file.replace(/\.devports$/, '')
  );

  // Read existing .gitignore
  const gitignorePath = '.gitignore';
  let gitignoreContent = '';
  const existingEntries = new Set<string>();

  if (existsSync(gitignorePath)) {
    gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    // Parse existing entries (ignore comments and empty lines)
    const lines = gitignoreContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    for (const line of lines) {
      existingEntries.add(line);
    }
  }

  // Determine which entries to add
  const toAdd: string[] = [];
  const existing: string[] = [];

  for (const targetFile of targetFiles) {
    if (existingEntries.has(targetFile)) {
      existing.push(targetFile);
    } else {
      toAdd.push(targetFile);
    }
  }

  // Add new entries if not in dry-run mode
  if (!options.dryRun && toAdd.length > 0) {
    let newContent = gitignoreContent;

    // Add header comment if this is the first devports entry
    const hasDevportsComment = gitignoreContent.includes(
      '# devports generated files'
    );
    if (!hasDevportsComment && toAdd.length > 0) {
      if (newContent && !newContent.endsWith('\n')) {
        newContent += '\n';
      }
      newContent += '\n# devports generated files\n';
    }

    // Add new entries
    for (const file of toAdd) {
      newContent += `${file}\n`;
    }

    writeFileSync(gitignorePath, newContent);
  }

  return {
    added: toAdd,
    existing,
    devportsFiles,
  };
}

/**
 * Remove devports-related entries from .gitignore
 */
export async function cleanGitignore(
  options: { dryRun?: boolean } = {}
): Promise<GitignoreResult> {
  const gitignorePath = '.gitignore';

  if (!existsSync(gitignorePath)) {
    return {
      added: [],
      existing: [],
      devportsFiles: [],
    };
  }

  // Find all *.devports files to determine what should be in gitignore
  const devportsFiles = await glob('**/*.devports', {
    ignore: ['node_modules/**', '.git/**'],
  });

  const targetFiles = devportsFiles.map((file) =>
    file.replace(/\.devports$/, '')
  );

  // Read and parse .gitignore
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  const lines = gitignoreContent.split('\n');

  const newLines: string[] = [];
  const removed: string[] = [];
  let inDevportsSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Track if we're in the devports section
    if (trimmedLine === '# devports generated files') {
      inDevportsSection = true;
      // Skip the header if no devports files exist
      if (devportsFiles.length > 0) {
        newLines.push(line);
      }
      continue;
    }

    // If we hit a new section comment or end of devports entries
    if (
      inDevportsSection &&
      trimmedLine.startsWith('#') &&
      trimmedLine !== '# devports generated files'
    ) {
      inDevportsSection = false;
    }

    // Remove entries that correspond to existing .devports files
    if (inDevportsSection && trimmedLine && !trimmedLine.startsWith('#')) {
      if (targetFiles.includes(trimmedLine)) {
        removed.push(trimmedLine);
        continue; // Skip this line
      }
    }

    // Check if this is a stale entry (target file exists but no .devports file)
    if (inDevportsSection && trimmedLine && !trimmedLine.startsWith('#')) {
      const hasDevportsFile = devportsFiles.some(
        (devFile) => devFile.replace(/\.devports$/, '') === trimmedLine
      );
      if (!hasDevportsFile) {
        removed.push(trimmedLine);
        continue; // Skip stale entries
      }
    }

    newLines.push(line);
  }

  // Write updated .gitignore if not in dry-run mode
  if (!options.dryRun && removed.length > 0) {
    writeFileSync(gitignorePath, newLines.join('\n'));
  }

  return {
    added: [],
    existing: targetFiles.filter((file) => !removed.includes(file)),
    devportsFiles,
  };
}

/**
 * List what would be added to .gitignore without making changes
 */
export async function previewGitignore(): Promise<GitignoreResult> {
  return updateGitignore({ dryRun: true });
}
