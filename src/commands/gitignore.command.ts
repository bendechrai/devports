import {
  Command,
  CommandOptions,
  CommandResult,
  handleCommandError,
} from './base-command.js';
import {
  updateGitignore,
  cleanGitignore,
  previewGitignore,
} from '../gitignore.js';
import { sanitizeForDisplay } from '../validation.js';

export class GitignoreCommand implements Command {
  name = 'gitignore';
  description = 'Manage .gitignore entries for *.devports files';

  async execute(
    args: string[],
    options: CommandOptions
  ): Promise<CommandResult> {
    try {
      let result;

      if (options.clean) {
        result = await cleanGitignore();
      } else if (options.preview) {
        result = await previewGitignore();
      } else {
        result = await updateGitignore();
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return { success: true, data: result };
      }

      if (options.preview) {
        console.log('\nGitignore Preview:\n');
      } else if (options.clean) {
        console.log('\nCleaned .gitignore:\n');
      } else {
        console.log('\nUpdated .gitignore:\n');
      }

      console.log(`📁 Found ${result.devportsFiles.length} *.devports files`);

      if (result.devportsFiles.length > 0) {
        console.log(
          `   ${result.devportsFiles
            .map((f) => sanitizeForDisplay(f))
            .join(', ')}`
        );
        console.log('');
      }

      if (result.added.length > 0) {
        console.log(
          `✅ ${options.preview ? 'Would add' : 'Added'} ${result.added.length} entries:`
        );
        result.added.forEach((file) =>
          console.log(`   + ${sanitizeForDisplay(file)}`)
        );
      }

      if (result.existing.length > 0) {
        console.log(
          `ℹ️  ${result.existing.length} entries already in .gitignore:`
        );
        result.existing.forEach((file) =>
          console.log(`   ~ ${sanitizeForDisplay(file)}`)
        );
      }

      if (result.added.length === 0 && result.existing.length === 0) {
        console.log('✅ No changes needed');
      }

      if (options.preview && result.added.length > 0) {
        console.log(`\nRun 'devports gitignore' to apply changes.`);
      }

      return { success: true, data: result };
    } catch (error) {
      handleCommandError(error, options);
      return { success: false };
    }
  }
}
