import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { Config, Registry } from './types.js';

function getConfigDir(): string {
  return (
    process.env.DEVPORTS_CONFIG_DIR ?? join(homedir(), '.config', 'devports')
  );
}

function getConfigFile(): string {
  return join(getConfigDir(), 'config.json');
}

function getRegistryFile(): string {
  return join(getConfigDir(), 'ports.json');
}

const DEFAULT_CONFIG: Omit<Config, 'registryPath'> = {
  ranges: {
    postgres: { start: 5434, end: 5499 },
    mysql: { start: 3308, end: 3399 },
    redis: { start: 6381, end: 6399 },
    api: { start: 3002, end: 3099 },
    app: { start: 5002, end: 5999 },
    custom: { start: 8002, end: 8999 },
  },
};

const DEFAULT_REGISTRY: Registry = {
  allocations: [],
  reservations: [
    {
      port: 8080,
      reason: 'Common development server port',
      reservedAt: new Date().toISOString(),
    },
  ],
};

export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    try {
      mkdirSync(configDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create config directory at ${configDir}: ${(error as Error).message}`
      );
    }
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  const configFile = getConfigFile();

  if (!existsSync(configFile)) {
    try {
      const defaultConfig = {
        ...DEFAULT_CONFIG,
        registryPath: getRegistryFile(),
      };
      writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    } catch (error) {
      throw new Error(
        `Failed to create config file at ${configFile}: ${(error as Error).message}`
      );
    }
  }

  try {
    const content = readFileSync(configFile, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Config file ${configFile} contains invalid JSON: ${error.message}`
      );
    }
    throw new Error(
      `Failed to read config file ${configFile}: ${(error as Error).message}`
    );
  }
}

export function loadRegistry(): Registry {
  const config = loadConfig();
  const registryPath = config.registryPath;

  if (!existsSync(registryPath)) {
    try {
      writeFileSync(registryPath, JSON.stringify(DEFAULT_REGISTRY, null, 2));
      return DEFAULT_REGISTRY;
    } catch (error) {
      throw new Error(
        `Failed to create registry file at ${registryPath}: ${(error as Error).message}`
      );
    }
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content) as Registry;

    // Validate registry structure
    if (!registry.allocations || !Array.isArray(registry.allocations)) {
      throw new Error(
        'Registry file is corrupted: missing or invalid allocations array'
      );
    }
    if (!registry.reservations || !Array.isArray(registry.reservations)) {
      throw new Error(
        'Registry file is corrupted: missing or invalid reservations array'
      );
    }

    return registry;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Registry file ${registryPath} contains invalid JSON: ${error.message}`
      );
    }
    throw error;
  }
}

export function saveRegistry(registry: Registry): void {
  const config = loadConfig();
  try {
    writeFileSync(config.registryPath, JSON.stringify(registry, null, 2));
  } catch (error) {
    throw new Error(
      `Failed to save registry to ${config.registryPath}: ${(error as Error).message}`
    );
  }
}
