/**
 * Secure setup operations with input validation and safe command execution
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { basename, join } from 'path';
import { glob } from 'glob';
import { allocatePort } from './port-manager.js';
import {
  detectServicesFromTemplate,
  extractProjectNameFromTemplate,
  makeUrlSafe,
  processTemplate,
} from './render.js';
import { safeScriptExecution } from './execution.js';
import {
  validateServices,
  validateTemplatePath,
  validateScriptPath,
} from './validation.js';

export interface SetupOptions {
  template?: string;
  services?: string[];
  force?: boolean;
  skipRender?: boolean;
  postHook?: string;
}

export interface SetupResult {
  projectName: string;
  allocatedPorts: Record<string, number>;
  renderedFiles: string[];
}

/**
 * Secure version of setupCurrentDirectory with input validation and safe execution
 */
export async function setupCurrentDirectory(
  options: SetupOptions = {}
): Promise<SetupResult> {
  // Safety check: ensure we're in a main clone, not a worktree
  if (!isMainClone()) {
    throw new Error(
      'Setup can only be run in the main repository clone. ' +
        'Use "devports worktree add" to create worktrees with port allocation.'
    );
  }

  // Validate all inputs first (but don't check template existence yet - handled later)
  const validatedTemplate = options.template;
  const validatedPostHook = options.postHook
    ? validateScriptPath(options.postHook)
    : undefined;

  let validatedServices;
  if (options.services) {
    const validatedServiceList = validateServices(options.services);
    validatedServices = validatedServiceList.map(
      (s) => `${s.service}:${s.type}`
    );
  }

  const currentDir = process.cwd();
  const envPath = join(currentDir, '.env');
  const backupPath = join(currentDir, '.env.backup');

  // Check if .env already exists
  if (existsSync(envPath) && !options.force) {
    throw new Error(
      '.env file already exists. Use --force to overwrite (this will create .env.backup).'
    );
  }

  // Backup existing .env if using --force
  if (existsSync(envPath) && options.force) {
    writeFileSync(backupPath, readFileSync(envPath, 'utf-8'));
    console.log(`📋 Backed up existing .env to .env.backup`);
  }

  // Determine template and extract project info
  const templatePath = validatedTemplate
    ? validatedTemplate.startsWith('/')
      ? validatedTemplate
      : join(currentDir, validatedTemplate)
    : join(currentDir, '.env.devports');
  let templateContent: string | null = null;
  let projectName: string | null = null;
  let services: string[];

  if (existsSync(templatePath)) {
    // Validate template path if it exists
    if (validatedTemplate) {
      validateTemplatePath(templatePath);
    }
    try {
      templateContent = readFileSync(templatePath, 'utf-8');
      services =
        validatedServices ??
        detectServicesFromTemplate(templateContent, templatePath);

      // If no services detected from template, fall back to default
      if (!validatedServices && services.length === 0) {
        services = detectServicesFromEnv();
      }

      projectName = extractProjectNameFromTemplate(templateContent);
    } catch {
      console.warn(
        `⚠️  Could not read template ${templatePath}, falling back to detection`
      );
      services = validatedServices ?? detectServicesFromEnv();
    }
  } else if (validatedServices) {
    services = validatedServices;
  } else {
    services = detectServicesFromEnv();
  }

  // Use project name from template or directory name
  const finalProjectName = projectName ?? basename(process.cwd());
  const urlSafeProjectName = makeUrlSafe(finalProjectName);

  console.log(`✅ Setting up ${finalProjectName}...`);

  if (services.length > 0) {
    console.log(
      `📍 Detected services: ${services.map((s) => s.split(':')[0]).join(', ')}`
    );
  }

  // Allocate ports for each service
  const allocatedPorts: Record<string, number> = {};
  const serviceTypes: Record<string, string> = {};
  for (const service of services) {
    const [serviceName, serviceType] = service.split(':');
    const port = await allocatePort(
      urlSafeProjectName,
      serviceName,
      serviceType
    );
    allocatedPorts[serviceName] = port;
    serviceTypes[serviceName] = serviceType;
  }

  if (Object.keys(allocatedPorts).length > 0) {
    console.log('🔌 Allocated ports:');
    for (const [service, port] of Object.entries(allocatedPorts)) {
      const type = serviceTypes[service];
      console.log(`   ${service}: ${port} (${type})`);
    }
  }

  // Generate .env file
  if (templateContent) {
    const processedContent = processTemplate(
      templateContent,
      allocatedPorts,
      urlSafeProjectName,
      templatePath
    );
    writeFileSync(envPath, processedContent);
    console.log(`📝 Generated .env from ${basename(templatePath)}`);
  } else if (Object.keys(allocatedPorts).length > 0) {
    // Create basic .env with just port variables
    const envContent = `${[
      '# Generated by devports setup',
      `DEVPORTS_PROJECT_NAME=${finalProjectName}`,
      '',
      ...Object.entries(allocatedPorts).map(
        ([serviceName, port]) => `${serviceName.toUpperCase()}_PORT=${port}`
      ),
    ].join('\n')}\n`;
    writeFileSync(envPath, envContent);
    console.log('📝 Generated basic .env with allocated ports');
  }

  // Auto-render *.devports files
  const renderedFiles: string[] = [];
  if (!options.skipRender) {
    const rendered = await autoRenderDevportsFiles(
      process.cwd(),
      allocatedPorts,
      urlSafeProjectName
    );
    renderedFiles.push(...rendered);
  }

  // Run post-hook if available
  if (validatedPostHook || existsSync('.devports/hooks/post-setup')) {
    await runPostHook(
      process.cwd(),
      allocatedPorts,
      urlSafeProjectName,
      validatedPostHook
    );
  }

  console.log('✅ Setup complete!');

  return {
    projectName: finalProjectName,
    allocatedPorts,
    renderedFiles,
  };
}

/**
 * Check if we're in the main clone (not a worktree)
 */
function isMainClone(): boolean {
  try {
    // In main clone, .git is a directory
    // In worktree, .git is a file containing path to main .git
    const gitPath = join(process.cwd(), '.git');
    return existsSync(gitPath) && statSync(gitPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Detect services from existing .env file in current directory
 */
function detectServicesFromEnv(): string[] {
  const services: string[] = [];
  const envPath = join(process.cwd(), '.env');

  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');

    const portPatterns = [
      { regex: /DATABASE_PORT|POSTGRES_PORT/i, service: 'postgres:postgres' },
      { regex: /MYSQL_PORT/i, service: 'mysql:mysql' },
      { regex: /REDIS_PORT/i, service: 'redis:redis' },
      { regex: /API_PORT/i, service: 'api:api' },
      { regex: /APP_PORT|WEB_PORT/i, service: 'app:app' },
    ];

    for (const pattern of portPatterns) {
      if (
        pattern.regex.test(envContent) &&
        !services.includes(pattern.service)
      ) {
        services.push(pattern.service);
      }
    }
  }

  // Default to postgres if nothing detected
  if (services.length === 0) {
    services.push('postgres:postgres');
  }

  return services;
}

/**
 * Auto-render any *.devports files found in the current directory
 */
async function autoRenderDevportsFiles(
  currentPath: string,
  allocatedPorts: Record<string, number>,
  projectName: string
): Promise<string[]> {
  try {
    const devportsFiles = await glob('**/*.devports', {
      cwd: currentPath,
      ignore: ['node_modules/**', '.git/**'],
    });

    if (devportsFiles.length === 0) {
      return [];
    }

    console.log(
      `🔄 Auto-rendering ${devportsFiles.length} *.devports files...`
    );
    const renderedFiles: string[] = [];

    for (const devportsFile of devportsFiles) {
      const fullDevportsPath = join(currentPath, devportsFile);
      const outputPath = join(
        currentPath,
        devportsFile.replace(/\.devports$/, '')
      );

      try {
        const templateContent = readFileSync(fullDevportsPath, 'utf-8');
        const processedContent = processTemplate(
          templateContent,
          allocatedPorts,
          projectName,
          devportsFile
        );

        writeFileSync(outputPath, processedContent);
        const outputFileName = devportsFile.replace(/\.devports$/, '');
        console.log(`   ${outputFileName} (from ${devportsFile})`);
        renderedFiles.push(outputFileName);
      } catch (error) {
        console.warn(
          `⚠️  Failed to render ${devportsFile}: ${(error as Error).message}`
        );
      }
    }

    return renderedFiles;
  } catch (error) {
    console.warn(
      `⚠️  Error during auto-rendering: ${(error as Error).message}`
    );
    return [];
  }
}

/**
 * Run post-setup hook if available (secure version)
 */
async function runPostHook(
  currentPath: string,
  allocatedPorts: Record<string, number>,
  projectName: string,
  customHook?: string
): Promise<void> {
  const hookScript = customHook ?? '.devports/hooks/post-setup';

  if (!existsSync(hookScript)) {
    return;
  }

  try {
    console.log('🔗 Running post-setup hook...');

    // Prepare environment variables
    const hookEnv: Record<string, string> = {
      DEVPORTS_PROJECT_NAME: projectName,
      DEVPORTS_SETUP_PATH: currentPath,
    };

    // Add all port variables
    for (const [service, port] of Object.entries(allocatedPorts)) {
      const varName = `${service.toUpperCase().replace(/-/g, '_')}_PORT`;
      hookEnv[varName] = port.toString();
    }

    // Execute hook script safely
    await safeScriptExecution(hookScript, hookEnv, {
      cwd: currentPath,
    });

    console.log('✅ Post-setup hook completed');
  } catch (error) {
    console.warn(`⚠️  Post-setup hook failed: ${(error as Error).message}`);
  }
}
