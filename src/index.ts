// Public API for programmatic usage
export {
  allocatePort,
  releasePort,
  releasePortByNumber,
  listAllocations,
  getStatus,
  reservePort,
  unreservePort,
} from './port-manager.js';

export {
  loadConfig,
  loadRegistry,
  saveRegistry,
  ensureConfigDir,
} from './config.js';

export { checkPortInUse, findAvailablePort } from './port-utils.js';

export { setupCurrentDirectory } from './setup.js';

export type { SetupOptions, SetupResult } from './setup.js';

export type { PortRange, Config, PortAllocation, Registry } from './types.js';
