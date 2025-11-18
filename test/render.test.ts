import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, chmodSync, readdirSync } from 'fs';
import {
  getCommentStyleForFile,
  detectServicesFromTemplate,
  detectServicesFromAllTemplates,
  processTemplate,
  findCommentRanges,
  extractProjectNameFromTemplate,
  renderFile,
} from '../src/render.js';
import { allocatePort, releasePort } from '../src/port-manager.js';

describe('Render Module - Comment Handling', () => {
  describe('getCommentStyleForFile', () => {
    it('should return # comment style for .env files', () => {
      expect(getCommentStyleForFile('test.env.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return # comment style for .yml files', () => {
      expect(getCommentStyleForFile('docker-compose.yml.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return // comment style for .js files', () => {
      expect(getCommentStyleForFile('config.js.devports')).toEqual({
        lineComment: '//',
        blockStart: '/*',
        blockEnd: '*/',
      });
    });

    it('should return HTML comment style for .html files', () => {
      expect(getCommentStyleForFile('index.html.devports')).toEqual({
        blockStart: '<!--',
        blockEnd: '-->',
      });
    });

    it('should return -- comment style for .sql files', () => {
      expect(getCommentStyleForFile('schema.sql.devports')).toEqual({
        lineComment: '--',
        blockStart: '/*',
        blockEnd: '*/',
      });
    });

    it('should return lua comment style for .lua files', () => {
      expect(getCommentStyleForFile('script.lua.devports')).toEqual({
        lineComment: '--',
      });
    });

    it('should return vim comment style for .vim files', () => {
      expect(getCommentStyleForFile('config.vim.devports')).toEqual({
        lineComment: '"',
      });
    });

    it('should return -- comment style for .go files', () => {
      expect(getCommentStyleForFile('main.go.devports')).toEqual({
        lineComment: '//',
        blockStart: '/*',
        blockEnd: '*/',
      });
    });

    it('should return appropriate style for .py files', () => {
      expect(getCommentStyleForFile('script.py.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return appropriate style for .rb files', () => {
      expect(getCommentStyleForFile('script.rb.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return appropriate style for .sh files', () => {
      expect(getCommentStyleForFile('script.sh.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return appropriate style for .toml files', () => {
      expect(getCommentStyleForFile('config.toml.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return appropriate style for .ini files', () => {
      expect(getCommentStyleForFile('config.ini.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should return appropriate style for .props files', () => {
      expect(getCommentStyleForFile('app.properties.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should handle files without extension', () => {
      expect(getCommentStyleForFile('Dockerfile.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should default to # for unknown extensions', () => {
      expect(getCommentStyleForFile('unknown.ext.devports')).toEqual({
        lineComment: '#',
      });
    });

    it('should default to # when no file path provided', () => {
      expect(getCommentStyleForFile()).toEqual({
        lineComment: '#',
      });
    });
  });

  describe('findCommentRanges', () => {
    it('should find # comment ranges', () => {
      const content = `# This is a comment
API_PORT=3000
# Another comment with {devports:type:service}`;

      const ranges = findCommentRanges(content, 'test.env.devports');

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toEqual({ start: 0, end: 19 }); // "# This is a comment"
      expect(ranges[1]).toEqual({ start: 34, end: 80 }); // "# Another comment with {devports:type:service}"
    });

    it('should find // comment ranges', () => {
      const content = `// This is a comment
const port = 3000;
// Another comment`;

      const ranges = findCommentRanges(content, 'test.js.devports');

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toEqual({ start: 0, end: 20 });
      expect(ranges[1]).toEqual({ start: 40, end: 58 });
    });

    it('should find block comment ranges', () => {
      const content = `/* Block comment */
const port = 3000;
/* Another
   block comment */`;

      const ranges = findCommentRanges(content, 'test.js.devports');

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toEqual({ start: 0, end: 19 }); // "/* Block comment */"
      expect(ranges[1]).toEqual({ start: 39, end: 69 }); // "/* Another\n   block comment */"
    });

    it('should ignore comment markers inside strings', () => {
      const content = `const url = "http://example.com"; // Real comment
const path = 'path/with#hash';
/* Block comment */`;

      const ranges = findCommentRanges(content, 'test.js.devports');

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toEqual({ start: 34, end: 49 }); // "// Real comment"
      expect(ranges[1]).toEqual({ start: 81, end: 100 }); // "/* Block comment */"
    });
  });

  describe('detectServicesFromTemplate', () => {
    it('should detect services from non-comment lines only', () => {
      const template = `# Comment with {devports:type:invalid-service} - should be ignored
# Another comment with {devports:postgres:comment-db}
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
# More comments {devports:api:comment-api}
API_PORT={devports:api:server}
REDIS_URL=redis://localhost:{devports:redis:cache}`;

      const services = detectServicesFromTemplate(
        template,
        'test.env.devports'
      );

      // Should only detect services from non-comment lines
      expect(services).toEqual(['main:postgres', 'server:api', 'cache:redis']);
      expect(services).not.toContain('invalid-service:type');
      expect(services).not.toContain('comment-db:postgres');
      expect(services).not.toContain('comment-api:api');
    });

    it('should handle different comment styles based on file extension', () => {
      const jsTemplate = `// Comment with {devports:api:comment-service}
const port = {devports:api:real-service};
/* Block comment {devports:postgres:block-db} */
const dbUrl = "postgres://localhost:{devports:postgres:actual-db}/db";`;

      const services = detectServicesFromTemplate(
        jsTemplate,
        'config.js.devports'
      );

      // Should only detect services from non-comment lines
      expect(services).toEqual(['real-service:api', 'actual-db:postgres']);
      expect(services).not.toContain('comment-service:api');
      expect(services).not.toContain('block-db:postgres');
    });

    it('should handle YAML comments', () => {
      const yamlTemplate = `# YAML comment with {devports:app:comment-service}
services:
  web:
    ports:
      - "{devports:app:web}:3000"  # Inline comment {devports:redis:inline}
  db:
    ports:
      - "{devports:postgres:database}:5432"`;

      const services = detectServicesFromTemplate(
        yamlTemplate,
        'docker-compose.yml.devports'
      );

      expect(services).toEqual(['web:app', 'database:postgres']);
      expect(services).not.toContain('comment-service:app');
      expect(services).not.toContain('inline:redis');
    });

    it('should remove duplicate services', () => {
      const template = `DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
DATABASE_TEST_URL=postgresql://user@localhost:{devports:postgres:main}/test_db
API_PORT={devports:api:server}
API_BACKUP_PORT={devports:api:server}`;

      const services = detectServicesFromTemplate(
        template,
        'test.env.devports'
      );

      // Should remove duplicates
      expect(services).toEqual(['main:postgres', 'server:api']);
      expect(services).toHaveLength(2);
    });

    it('should warn about malformed patterns but still detect valid ones', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const template = `# Valid comment with {devports:invalid} - should be ignored
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
API_PORT={devports:malformed}
REDIS_URL=redis://localhost:{devports:redis:cache}`;

      const services = detectServicesFromTemplate(
        template,
        'test.env.devports'
      );

      // Should detect all valid patterns (including those with valid syntax but invalid types)
      expect(services).toEqual(['main:postgres', 'cache:redis']);

      // Should warn about malformed pattern in non-comment line
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid devports pattern: {devports:malformed}'
        )
      );

      consoleSpy.mockRestore();
    });
  });

  describe('New Project Syntax {devports:project}', () => {
    it('should process {devports:project} syntax correctly', () => {
      const template = `Project: {devports:project}
API_URL=https://{devports:project}.example.com
PORT={devports:api:server}`;

      const ports = { server: 3000 };
      const result = processTemplate(template, ports, 'my-app');

      expect(result).toContain('Project: my-app');
      expect(result).toContain('API_URL=https://my-app.example.com');
      expect(result).toContain('PORT=3000');
    });

    it('should work alongside service patterns', () => {
      const template = `PROJECT_NAME={devports:project}
DATABASE_URL=postgresql://user@localhost:{devports:postgres:db}/{devports:project}`;

      const ports = { db: 5432 };
      const result = processTemplate(template, ports, 'test-app');

      expect(result).toContain('PROJECT_NAME=test-app');
      expect(result).toContain(
        'DATABASE_URL=postgresql://user@localhost:5432/test-app'
      );
    });
  });

  describe('processTemplate', () => {
    it('should process template variables in non-comment lines only', () => {
      const template = `# =============================================================================
# EXAMPLE TEMPLATE - Environment Template for Devports
# =============================================================================
# This template shows {DEVPORTS_PROJECT_NAME} and {devports:type:service}
# Template patterns:
# - {DEVPORTS_PROJECT_NAME} → URL-safe project name
# - {devports:postgres:main} → Allocated port for service
# =============================================================================

# Project identifier
DEVPORTS_PROJECT_NAME={devports:project}

# Database Configuration
# PostgreSQL connection with {devports:postgres:main}
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db

# API Configuration
# Server port {devports:api:server}
API_PORT={devports:api:server}`;

      const ports = {
        main: 5432,
        server: 3000,
      };

      const result = processTemplate(
        template,
        ports,
        'test-project',
        'config.env.devports'
      );

      // Check that comments are preserved unchanged
      expect(result).toContain(
        '# This template shows {DEVPORTS_PROJECT_NAME} and {devports:type:service}'
      );
      expect(result).toContain(
        '# - {DEVPORTS_PROJECT_NAME} → URL-safe project name'
      );
      expect(result).toContain(
        '# - {devports:postgres:main} → Allocated port for service'
      );
      expect(result).toContain(
        '# PostgreSQL connection with {devports:postgres:main}'
      );
      expect(result).toContain('# Server port {devports:api:server}');

      // Check that actual variables are processed
      expect(result).toContain('DEVPORTS_PROJECT_NAME=test-project');
      expect(result).toContain(
        'DATABASE_URL=postgresql://user@localhost:5432/db'
      );
      expect(result).toContain('API_PORT=3000');

      // Make sure comment placeholders weren't replaced
      expect(result).not.toContain(
        '# This template shows test-project and 3000'
      );
    });

    it('should handle different comment styles for different file types', () => {
      const jsTemplate = `// Configuration for {DEVPORTS_PROJECT_NAME}
// API port: {devports:api:server}
const config = {
  projectName: '{devports:project}',
  apiPort: {devports:api:server},
  /* Database: {devports:postgres:main} */
  dbPort: {devports:postgres:main}
};`;

      const ports = {
        server: 8080,
        main: 5433,
      };

      const result = processTemplate(
        jsTemplate,
        ports,
        'my-project',
        'config.js.devports'
      );

      // Comments should be preserved
      expect(result).toContain('// Configuration for {DEVPORTS_PROJECT_NAME}');
      expect(result).toContain('// API port: {devports:api:server}');
      expect(result).toContain('/* Database: {devports:postgres:main} */');

      // Actual variables should be processed
      expect(result).toContain("projectName: 'my-project'");
      expect(result).toContain('apiPort: 8080');
      expect(result).toContain('dbPort: 5433');
    });

    it('should handle YAML with inline comments', () => {
      const yamlTemplate = `# Docker compose for {DEVPORTS_PROJECT_NAME}
services:
  web:
    ports:
      - "{devports:app:web}:3000"  # External port {devports:app:web}
  db:
    ports:
      - "{devports:postgres:main}:5432"  # DB port: {devports:postgres:main}
# End of {DEVPORTS_PROJECT_NAME} config`;

      const ports = {
        web: 8000,
        main: 5440,
      };

      const result = processTemplate(
        yamlTemplate,
        ports,
        'docker-app',
        'docker-compose.yml.devports'
      );

      // Check that inline comments are preserved with their original placeholders
      expect(result).toContain('# External port {devports:app:web}');
      expect(result).toContain('# DB port: {devports:postgres:main}');
      expect(result).toContain('# Docker compose for {DEVPORTS_PROJECT_NAME}');
      expect(result).toContain('# End of {DEVPORTS_PROJECT_NAME} config');

      // Check that actual variables are processed only in non-comment parts
      expect(result).toContain('"8000:3000"');
      expect(result).toContain('"5440:5432"');

      // Verify complete lines are as expected
      expect(result).toContain(
        '      - "8000:3000"  # External port {devports:app:web}'
      );
      expect(result).toContain(
        '      - "5440:5432"  # DB port: {devports:postgres:main}'
      );
    });

    it('should handle escaped quotes within strings', () => {
      const template = `// Comment with {devports:project}
const message = "This is a string with \\"quotes\\" and {devports:project}";
const port = {devports:api:server};`;

      const ports = { server: 4000 };
      const result = processTemplate(
        template,
        ports,
        'test-app',
        'config.js.devports'
      );

      expect(result).toContain('// Comment with {devports:project}');
      expect(result).toContain(
        'const message = "This is a string with \\"quotes\\" and test-app";'
      );
      expect(result).toContain('const port = 4000;');
    });

    it('should handle single quotes in strings', () => {
      const template = `// Comment: {devports:project}
const config = {
  name: '{devports:project}',
  port: {devports:web:main}
};`;

      const ports = { main: 5000 };
      const result = processTemplate(
        template,
        ports,
        'my-app',
        'config.js.devports'
      );

      expect(result).toContain('// Comment: {devports:project}');
      expect(result).toContain("name: 'my-app'");
      expect(result).toContain('port: 5000');
    });

    it('should handle block comments in JavaScript/CSS files', () => {
      const template = `/* Project: {devports:project}
   Port configuration for {devports:api:server}
*/
const config = {
  project: '{devports:project}',
  port: {devports:api:server}
};`;

      const ports = { server: 3500 };
      const result = processTemplate(
        template,
        ports,
        'block-test',
        'app.js.devports'
      );

      expect(result).toContain('/* Project: {devports:project}');
      expect(result).toContain(
        '   Port configuration for {devports:api:server}'
      );
      expect(result).toContain('*/');
      expect(result).toContain("project: 'block-test'");
      expect(result).toContain('port: 3500');
    });

    it('should handle HTML comments', () => {
      const template = `<!-- Configuration for {devports:project} -->
<!-- API endpoint: {devports:api:main} -->
<script>
  const apiPort = {devports:api:main};
  const projectName = '{devports:project}';
</script>`;

      const ports = { main: 8080 };
      const result = processTemplate(
        template,
        ports,
        'html-app',
        'index.html.devports'
      );

      expect(result).toContain('<!-- Configuration for {devports:project} -->');
      expect(result).toContain('<!-- API endpoint: {devports:api:main} -->');
      expect(result).toContain('const apiPort = 8080;');
      expect(result).toContain("const projectName = 'html-app';");
    });

    it('should handle mixed comment types correctly', () => {
      const template = `# Shell comment: {devports:project}
// JavaScript comment: {devports:api:server}
/* Block comment: {devports:db:main} */
echo "Project: {devports:project}, Port: {devports:api:server}";`;

      const ports = { server: 6000, main: 5432 };
      const result = processTemplate(
        template,
        ports,
        'mixed-test',
        'script.sh.devports'
      );

      // All placeholders get replaced, including in comments
      expect(result).toContain('# Shell comment: {devports:project}'); // This pattern doesn't get replaced
      expect(result).toContain('// JavaScript comment: 6000'); // This gets replaced
      expect(result).toContain('/* Block comment: 5432 */'); // This gets replaced

      // Actual content should have replacements
      expect(result).toContain('echo "Project: mixed-test, Port: 6000";');
    });
  });

  describe('findCommentRanges edge cases', () => {
    it('should handle empty content', () => {
      const ranges = findCommentRanges('', 'test.js');
      expect(ranges).toEqual([]);
    });

    it('should handle content with no comments', () => {
      const content = 'const port = 3000;\nconst name = "test";';
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toEqual([]);
    });

    it('should find line comments correctly', () => {
      const content =
        'const port = 3000; // This is a comment\nconst name = "test";';
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(19); // Position of //
    });

    it('should find block comments correctly', () => {
      const content = 'const port = /* comment */ 3000;';
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(13); // Position of /*
      expect(ranges[0].end).toBe(26); // Position after */
    });

    it('should handle nested quotes in comments', () => {
      const content = `// Comment with "quotes" and 'single quotes'
const test = "string";`;
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(0); // Start of comment
    });

    it('should ignore comment syntax inside strings', () => {
      const content = `const comment = "This // is not a comment";
// This is a real comment`;
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(44); // Start of real comment
    });

    it('should handle escaped quotes in strings', () => {
      const content = `const str = "String with \\"escaped\\" quotes"; // Comment`;
      const ranges = findCommentRanges(content, 'test.js');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].start).toBe(46); // After the string
    });
  });

  describe('detectServicesFromTemplate additional cases', () => {
    it('should handle templates with no service patterns', () => {
      const template = 'Just some regular content without any service patterns';
      const services = detectServicesFromTemplate(template);
      expect(services).toEqual([]);
    });

    it('should handle malformed service patterns gracefully', () => {
      const template = '{devports:} {devports} {devports:incomplete';
      const services = detectServicesFromTemplate(template);
      expect(services).toEqual([]);
    });

    it('should handle services with special characters', () => {
      const template = 'Port: {devports:my-api_service:web-server}';
      const services = detectServicesFromTemplate(template);
      expect(services).toContain('web-server:my-api_service');
    });
  });

  describe('detectServicesFromAllTemplates', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a unique temporary directory for each test
      testDir = join(tmpdir(), `devports-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should detect services from multiple .devports files', async () => {
      // Create .env.devports with some services
      const envTemplate = `DATABASE_PORT={devports:postgres:main}
API_PORT={devports:api:server}`;
      writeFileSync(join(testDir, '.env.devports'), envTemplate);


      // Create docker-compose.dev.yml.devports with additional services
      const dockerTemplate = `
services:
  postgres:
    ports:
      - '{devports:postgres:main}:5432'
  postgres-test:
    ports:
      - '{devports:postgres:test}:5432'
  redis:
    ports:
      - '{devports:redis:cache}:6379'
`;
      writeFileSync(join(testDir, 'docker-compose.dev.yml.devports'), dockerTemplate);

      const services = await detectServicesFromAllTemplates(testDir);

      expect(services).toContain('main:postgres');
      expect(services).toContain('server:api');
      expect(services).toContain('test:postgres');
      expect(services).toContain('cache:redis');
      expect(services).toHaveLength(4);
    });

    it('should handle directory with no .devports files', async () => {
      // Create some regular files (non-.devports)
      writeFileSync(join(testDir, 'package.json'), '{}');
      writeFileSync(join(testDir, 'README.md'), '# Test');

      const services = await detectServicesFromAllTemplates(testDir);

      expect(services).toEqual([]);
    });

    it('should deduplicate services found in multiple files', async () => {
      // Both files reference the same service
      const template1 = 'DATABASE_PORT={devports:postgres:main}';
      const template2 = 'Port: {devports:postgres:main}:5432';

      writeFileSync(join(testDir, 'file1.devports'), template1);
      writeFileSync(join(testDir, 'file2.devports'), template2);

      const services = await detectServicesFromAllTemplates(testDir);

      expect(services).toEqual(['main:postgres']);
      expect(services).toHaveLength(1);
    });

    it('should handle files with read errors gracefully', async () => {
      // Create a valid file
      writeFileSync(join(testDir, 'valid.devports'), '{devports:postgres:main}');

      // Create an unreadable file (if possible on this system)
      const invalidFile = join(testDir, 'invalid.devports');
      writeFileSync(invalidFile, '{devports:api:server}');

      // Try to make it unreadable (may not work on all systems)
      try {
        chmodSync(invalidFile, 0o000);
      } catch {
        // Skip this test if chmod fails
      }

      const services = await detectServicesFromAllTemplates(testDir);

      // Should at least find the valid service
      expect(services).toContain('main:postgres');

      // Restore permissions for cleanup
      try {
        chmodSync(invalidFile, 0o644);
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should ignore node_modules and .git directories', async () => {
      // Create valid file in root
      writeFileSync(join(testDir, 'root.devports'), '{devports:postgres:main}');

      // Create files in ignored directories
      mkdirSync(join(testDir, 'node_modules'), { recursive: true });
      writeFileSync(join(testDir, 'node_modules', 'ignored.devports'), '{devports:api:server}');

      mkdirSync(join(testDir, '.git'), { recursive: true });
      writeFileSync(join(testDir, '.git', 'ignored.devports'), '{devports:redis:cache}');

      const services = await detectServicesFromAllTemplates(testDir);

      expect(services).toEqual(['main:postgres']);
      expect(services).toHaveLength(1);
    });

    it('should handle nested .devports files', async () => {
      // Create file in root
      writeFileSync(join(testDir, 'root.devports'), '{devports:postgres:main}');

      // Create nested directory with .devports file
      mkdirSync(join(testDir, 'config'), { recursive: true });
      writeFileSync(join(testDir, 'config', 'nested.devports'), '{devports:api:server}');

      const services = await detectServicesFromAllTemplates(testDir);

      expect(services).toContain('main:postgres');
      expect(services).toContain('server:api');
      expect(services).toHaveLength(2);
    });
  });

  describe('processTemplate error handling', () => {
    it('should handle undefined ports gracefully', () => {
      const template = 'Port: {devports:api:missing}';
      const ports = { existing: 3000 };

      const result = processTemplate(template, ports, 'test', 'test.txt');
      expect(result).toContain('Port: {devports:api:missing}'); // Should leave unfound patterns as-is
    });

    it('should handle empty template', () => {
      const result = processTemplate('', {}, 'test', 'test.txt');
      expect(result).toBe('');
    });

    it('should handle undefined file path', () => {
      const template =
        '# Comment {devports:project}\nPort: {devports:api:server}';
      const ports = { server: 4000 };

      const result = processTemplate(template, ports, 'test');
      expect(result).toContain('# Comment {devports:project}'); // Should preserve comment
      expect(result).toContain('Port: 4000');
    });
  });
});

describe('extractProjectNameFromTemplate', () => {
  it('should extract literal project name from template', () => {
    const template = 'DEVPORTS_PROJECT_NAME=myproject\nDATABASE_PORT=5432';
    expect(extractProjectNameFromTemplate(template)).toBe('myproject');
  });

  it('should extract quoted project name from template', () => {
    const template = 'DEVPORTS_PROJECT_NAME="my-project"\nDATABASE_PORT=5432';
    expect(extractProjectNameFromTemplate(template)).toBe('my-project');
  });

  it('should extract single-quoted project name from template', () => {
    const template = "DEVPORTS_PROJECT_NAME='my-project'\nDATABASE_PORT=5432";
    expect(extractProjectNameFromTemplate(template)).toBe('my-project');
  });

  it('should return null when DEVPORTS_PROJECT_NAME is not found', () => {
    const template = 'DATABASE_PORT=5432\nAPI_PORT=3000';
    expect(extractProjectNameFromTemplate(template)).toBeNull();
  });

  it('should return null when DEVPORTS_PROJECT_NAME has {devports:project} placeholder', () => {
    const template =
      'DEVPORTS_PROJECT_NAME={devports:project}\nDATABASE_PORT={devports:postgres:db}';
    expect(extractProjectNameFromTemplate(template)).toBeNull();
  });

  it('should return null when DEVPORTS_PROJECT_NAME has any other placeholder', () => {
    const template =
      'DEVPORTS_PROJECT_NAME={some:other:placeholder}\nDATABASE_PORT=5432';
    expect(extractProjectNameFromTemplate(template)).toBeNull();
  });

  it('should handle whitespace around project name', () => {
    const template = 'DEVPORTS_PROJECT_NAME=  my-project  \nDATABASE_PORT=5432';
    // Leading whitespace preserved, trailing whitespace from line is trimmed
    expect(extractProjectNameFromTemplate(template)).toBe('  my-project');
  });

  it('should handle project name with special characters', () => {
    const template =
      'DEVPORTS_PROJECT_NAME=my-project_v2.0\nDATABASE_PORT=5432';
    expect(extractProjectNameFromTemplate(template)).toBe('my-project_v2.0');
  });

  it('should handle empty project name', () => {
    const template = 'DEVPORTS_PROJECT_NAME=\nDATABASE_PORT=5432';
    expect(extractProjectNameFromTemplate(template)).toBeNull();
  });

  it('should find DEVPORTS_PROJECT_NAME among other lines', () => {
    const template = `# This is a comment
DATABASE_URL=postgresql://localhost:5432/db
DEVPORTS_PROJECT_NAME=test-project
API_PORT=3000
REDIS_URL=redis://localhost:6379`;
    expect(extractProjectNameFromTemplate(template)).toBe('test-project');
  });

  it('should handle CRLF line endings', () => {
    const template =
      'DEVPORTS_PROJECT_NAME=windows-project\r\nDATABASE_PORT=5432\r\n';
    expect(extractProjectNameFromTemplate(template)).toBe('windows-project');
  });
});

describe('renderFile Integration Tests', () => {
  let tempDir: string;
  let testTemplatePath: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = join(tmpdir(), `devports-render-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testTemplatePath = join(tempDir, 'test.env.devports');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clean up any allocations we might have created
    try {
      await releasePort('render-test-project', undefined, true);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should reuse existing port allocations instead of failing', async () => {
    // Create a template file
    const templateContent = `DEVPORTS_PROJECT_NAME=render-test-project
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
API_PORT={devports:api:server}`;
    writeFileSync(testTemplatePath, templateContent);

    // First, manually allocate ports for the project
    const dbPort = await allocatePort(
      'render-test-project',
      'main',
      'postgres'
    );
    const apiPort = await allocatePort('render-test-project', 'server', 'api');

    // Now render the template - this should reuse the existing allocations
    const result = await renderFile(testTemplatePath);

    expect(result.projectName).toBe('render-test-project');
    expect(result.allocatedPorts.main).toBe(dbPort);
    expect(result.allocatedPorts.server).toBe(apiPort);

    // Verify the rendered content uses the existing ports
    expect(result.content).toContain(
      `DATABASE_URL=postgresql://user@localhost:${dbPort}/db`
    );
    expect(result.content).toContain(`API_PORT=${apiPort}`);
  });

  it('should allocate new ports for services that do not have existing allocations', async () => {
    const templateContent = `DEVPORTS_PROJECT_NAME=render-test-partial
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
API_PORT={devports:api:server}
REDIS_URL=redis://localhost:{devports:redis:cache}`;
    writeFileSync(testTemplatePath, templateContent);

    // Pre-allocate only the database port
    const existingDbPort = await allocatePort(
      'render-test-partial',
      'main',
      'postgres'
    );

    // Render the template
    const result = await renderFile(testTemplatePath);

    expect(result.projectName).toBe('render-test-partial');

    // Database should reuse existing allocation
    expect(result.allocatedPorts.main).toBe(existingDbPort);

    // API and Redis should have new allocations
    expect(result.allocatedPorts.server).toBeDefined();
    expect(result.allocatedPorts.cache).toBeDefined();
    expect(result.allocatedPorts.server).not.toBe(existingDbPort);
    expect(result.allocatedPorts.cache).not.toBe(existingDbPort);
    expect(result.allocatedPorts.server).not.toBe(result.allocatedPorts.cache);

    // Clean up the partial allocations
    await releasePort('render-test-partial', undefined, true);
  });

  it('should work correctly when no prior allocations exist', async () => {
    const templateContent = `DEVPORTS_PROJECT_NAME=render-test-new
DATABASE_URL=postgresql://user@localhost:{devports:postgres:main}/db
API_PORT={devports:api:server}`;
    writeFileSync(testTemplatePath, templateContent);

    // Render without any pre-existing allocations
    const result = await renderFile(testTemplatePath);

    expect(result.projectName).toBe('render-test-new');
    expect(result.allocatedPorts.main).toBeDefined();
    expect(result.allocatedPorts.server).toBeDefined();
    expect(result.allocatedPorts.main).not.toBe(result.allocatedPorts.server);

    // Verify the content is properly rendered
    expect(result.content).toContain(
      `DATABASE_URL=postgresql://user@localhost:${result.allocatedPorts.main}/db`
    );
    expect(result.content).toContain(
      `API_PORT=${result.allocatedPorts.server}`
    );

    // Clean up
    await releasePort('render-test-new', undefined, true);
  });
});
