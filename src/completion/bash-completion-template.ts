/**
 * Bash completion template for devports CLI
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function generateBashCompletion(): string {
  // Read the static completion script
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const scriptPath = join(__dirname, 'bash.sh');
  return readFileSync(scriptPath, 'utf-8');
}
