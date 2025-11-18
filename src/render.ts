import { readFileSync, writeFileSync } from 'fs';
import { getOrAllocatePort } from './port-manager.js';
import MagicString from 'magic-string';

export interface RenderOptions {
  projectName?: string;
  outputFile?: string;
}

export interface RenderResult {
  content: string;
  allocatedPorts: Record<string, number>;
  projectName: string;
}

/**
 * Render a template file by replacing {devports:type:service-name} patterns with allocated ports
 */
export async function renderFile(
  filePath: string,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const templateContent = readFileSync(filePath, 'utf-8');

  // Extract project name from template or use provided option
  let projectName =
    options.projectName ?? extractProjectNameFromTemplate(templateContent);
  if (!projectName) {
    throw new Error(
      'No DEVPORTS_PROJECT_NAME found in template and none provided via options'
    );
  }

  // Make project name URL-safe
  projectName = makeUrlSafe(projectName);

  // Detect services from template patterns
  const services = detectServicesFromTemplate(templateContent, filePath);

  // Get or allocate ports for each service (reuses existing allocations)
  const allocatedPorts: Record<string, number> = {};
  for (const service of services) {
    const [serviceName, serviceType] = service.split(':');
    const port = await getOrAllocatePort(projectName, serviceName, serviceType);
    allocatedPorts[serviceName] = port;
  }

  // Process template content
  const renderedContent = processTemplate(
    templateContent,
    allocatedPorts,
    projectName,
    filePath
  );

  // Write to output file if specified
  if (options.outputFile) {
    writeFileSync(options.outputFile, renderedContent);
  }

  return {
    content: renderedContent,
    allocatedPorts,
    projectName,
  };
}

/**
 * Process template content using magic-string for efficient manipulation
 */
export function processTemplate(
  templateContent: string,
  ports: Record<string, number>,
  projectName: string,
  filePath?: string
): string {
  const s = new MagicString(templateContent);
  const commentRanges = findCommentRanges(templateContent, filePath);

  // Find all template patterns
  const patterns = [
    {
      regex: /\{devports:([^}]+)\}/g,
      replacement: (match: string, serviceDef: string) => {
        const parts = serviceDef.split(':');

        // Handle project syntax: {devports:project}
        if (parts.length === 1 && parts[0] === 'project') {
          return projectName;
        }

        // Handle service syntax: {devports:type:service-name}
        if (parts.length !== 2) {
          console.warn(
            `⚠️  Invalid devports pattern: ${match} - must be {devports:type:service-name} or {devports:project}`
          );
          return match;
        }
        const [, serviceName] = parts;
        return ports[serviceName]?.toString() || match;
      },
    },
  ];

  patterns.forEach(({ regex, replacement }) => {
    let match;
    regex.lastIndex = 0; // Reset regex state

    while ((match = regex.exec(templateContent)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Skip if inside a comment
      if (
        commentRanges.some((range) => start >= range.start && end <= range.end)
      ) {
        continue;
      }

      const replacementText =
        typeof replacement === 'function'
          ? replacement(match[0], match[1])
          : replacement;

      s.overwrite(start, end, replacementText);
    }
  });

  return s.toString();
}

/**
 * Extract DEVPORTS_PROJECT_NAME from template content
 */
export function extractProjectNameFromTemplate(
  templateContent: string
): string | null {
  const lines = templateContent.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('DEVPORTS_PROJECT_NAME=')) {
      const value = trimmedLine.split('=')[1];
      // Remove quotes if present
      const cleanValue = value?.replace(/^["']|["']$/g, '') || null;

      // If the value is a placeholder (like {devports:project}),
      // treat it as if no project name was specified
      if (
        cleanValue &&
        cleanValue.startsWith('{') &&
        cleanValue.endsWith('}')
      ) {
        return null;
      }

      return cleanValue;
    }
  }
  return null;
}

/**
 * Detect services from template file with {devports:type:service-name} patterns
 */
export function detectServicesFromTemplate(
  templateContent: string,
  filePath?: string
): string[] {
  const services: string[] = [];
  const commentRanges = findCommentRanges(templateContent, filePath);
  const servicePattern = /\{devports:([^}]+)\}/g;

  let match;
  while ((match = servicePattern.exec(templateContent)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Skip if inside a comment
    if (
      commentRanges.some((range) => start >= range.start && end <= range.end)
    ) {
      continue;
    }

    const serviceDef = match[1];
    const parts = serviceDef.split(':');

    // Skip the special {devports:project} placeholder
    if (parts.length === 1 && parts[0] === 'project') {
      continue;
    }

    if (parts.length !== 2) {
      console.warn(
        `⚠️  Invalid devports pattern: {devports:${serviceDef}} - must be {devports:type:service-name} or {devports:project}`
      );
      continue;
    }

    const [serviceType, serviceName] = parts;
    services.push(`${serviceName}:${serviceType}`);
  }

  return [...new Set(services)];
}

/**
 * Comment style configuration for different file types
 */
interface CommentStyle {
  lineComment?: string; // Single-line comment prefix (e.g., '#', '//')
  blockStart?: string; // Block comment start (e.g., '/*')
  blockEnd?: string; // Block comment end (e.g., '*/')
}

/**
 * Represents a range in the source text
 */
interface Range {
  start: number;
  end: number;
}

/**
 * Get comment style configuration for a file based on its extension
 */
export function getCommentStyleForFile(filePath?: string): CommentStyle {
  if (!filePath) {
    // Default to shell/env style comments
    return { lineComment: '#' };
  }

  // Remove .devports suffix to get the actual file type
  const actualPath = filePath.replace(/\.devports$/, '');
  const ext = actualPath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'env':
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'conf':
    case 'config':
    case 'yml':
    case 'yaml':
    case 'py':
    case 'rb':
    case 'r':
      return { lineComment: '#' };

    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'java':
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'h':
    case 'hpp':
    case 'cs':
    case 'php':
    case 'go':
    case 'rs':
    case 'scala':
    case 'swift':
      return {
        lineComment: '//',
        blockStart: '/*',
        blockEnd: '*/',
      };

    case 'json':
      // JSON doesn't officially support comments, but some parsers allow //
      return { lineComment: '//' };

    case 'html':
    case 'xml':
    case 'svg':
      return {
        blockStart: '<!--',
        blockEnd: '-->',
      };

    case 'sql':
      return {
        lineComment: '--',
        blockStart: '/*',
        blockEnd: '*/',
      };

    case 'lua':
      return { lineComment: '--' };

    case 'vim':
      return { lineComment: '"' };

    default:
      // For unknown extensions, detect based on content patterns
      return { lineComment: '#' }; // Most common default
  }
}

/**
 * Find all comment ranges in the content, respecting string literals
 */
export function findCommentRanges(content: string, filePath?: string): Range[] {
  const commentStyle = getCommentStyleForFile(filePath);
  const ranges: Range[] = [];

  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  while (i < content.length) {
    const char = content[i];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      escaped = true;
      i++;
      continue;
    }

    // Handle string literals
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }

    // Skip comment detection inside string literals
    if (inSingleQuote || inDoubleQuote) {
      i++;
      continue;
    }

    // Check for line comments
    if (
      commentStyle.lineComment &&
      content.slice(i).startsWith(commentStyle.lineComment)
    ) {
      const start = i;
      // Find end of line
      const lineEnd = content.indexOf('\n', i);
      const end = lineEnd === -1 ? content.length : lineEnd;
      ranges.push({ start, end });
      i = end;
      continue;
    }

    // Check for block comments
    if (
      commentStyle.blockStart &&
      content.slice(i).startsWith(commentStyle.blockStart)
    ) {
      const start = i;
      const blockEndPos = content.indexOf(
        commentStyle.blockEnd ?? '',
        i + commentStyle.blockStart.length
      );

      if (blockEndPos === -1) {
        // Block comment doesn't end - goes to end of file
        ranges.push({ start, end: content.length });
        break;
      } else {
        const end = blockEndPos + (commentStyle.blockEnd ?? '').length;
        ranges.push({ start, end });
        i = end;
        continue;
      }
    }

    i++;
  }

  return ranges;
}

/**
 * Make string URL/hostname safe
 */
export function makeUrlSafe(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
