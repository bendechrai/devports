import { LockManager } from './services/lock-manager.js';
import { loadConfig, loadRegistry } from './config.js';
import type { PortAllocation } from './types.js';
import { findAvailablePort, checkPortInUse } from './port-utils.js';

export async function allocatePort(
  project: string,
  service: string,
  type: string
): Promise<number> {
  const config = loadConfig();

  const serviceType = type;

  // Validate port type exists in config
  if (!config.ranges[serviceType]) {
    // Provide helpful error message with valid types
    const validTypes = Object.keys(config.ranges).join(', ');
    throw new Error(
      `No port range configured for type "${serviceType}". ` +
        `Valid types: ${validTypes}`
    );
  }

  return await LockManager.withRegistryLock(async (registry) => {
    const range = config.ranges[serviceType];

    // Check if this project/service already has an allocation
    const existing = registry.allocations.find(
      (a) => a.project === project && a.service === service
    );

    if (existing) {
      throw new Error(
        `Port ${existing.port} already allocated for ${project}/${service}. ` +
          `Use 'devports release ${project} ${service}' first.`
      );
    }

    // Find next available port (checking both devports allocations and actual port usage)
    const usedPorts = new Set([
      ...registry.allocations.map((a) => a.port),
      ...registry.reservations.map((r) => r.port),
    ]);

    const port = await findAvailablePort(range.start, range.end, usedPorts);

    if (!port) {
      throw new Error(
        `No available ports in range ${range.start}-${range.end} for ${serviceType}. ` +
          `All ports are either allocated by devports or in use by other processes.`
      );
    }

    // Double-check if the port is actually in use and warn if so
    const isInUse = await checkPortInUse(port);
    if (isInUse) {
      console.warn(
        `⚠️  Warning: Port ${port} is currently in use by another process. ` +
          `You may need to stop that process before using this port.`
      );
    }

    // Allocate the port
    const allocation: PortAllocation = {
      port,
      project,
      service,
      type: serviceType,
      allocatedAt: new Date().toISOString(),
    };

    registry.allocations.push(allocation);

    return port;
  });
}

/**
 * Get existing port allocation for a project/service combination
 */
export async function getExistingAllocation(
  project: string,
  service: string
): Promise<number | null> {
  return await LockManager.withRegistryLock((registry) => {
    const existing = registry.allocations.find(
      (a) => a.project === project && a.service === service
    );
    return existing ? existing.port : null;
  });
}

/**
 * Get or allocate a port for a project/service combination
 * This function first checks for existing allocations and returns them,
 * only allocating new ports when needed. Used by render command.
 */
export async function getOrAllocatePort(
  project: string,
  service: string,
  type: string
): Promise<number> {
  // First check if we already have an allocation
  const existingPort = await getExistingAllocation(project, service);
  if (existingPort !== null) {
    return existingPort;
  }

  // No existing allocation, so allocate a new port
  return await allocatePort(project, service, type);
}

export async function releasePort(
  project: string,
  service?: string,
  all = false
): Promise<number> {
  return await LockManager.withRegistryLock((registry) => {
    const before = registry.allocations.length;

    if (all) {
      // Release all ports for this project
      registry.allocations = registry.allocations.filter(
        (a) => a.project !== project
      );
    } else if (service) {
      // Release specific service
      registry.allocations = registry.allocations.filter(
        (a) => !(a.project === project && a.service === service)
      );
    } else {
      throw new Error('Must specify --all or provide a service name');
    }

    const released = before - registry.allocations.length;
    return released;
  });
}

export async function releasePortByNumber(port: number): Promise<boolean> {
  return await LockManager.withRegistryLockConditional((registry) => {
    const before = registry.allocations.length;

    registry.allocations = registry.allocations.filter((a) => a.port !== port);

    const released = before > registry.allocations.length;

    return {
      result: released,
      shouldSave: released, // Only save if something was actually released
    };
  });
}

export function listAllocations(filters?: {
  project?: string;
  type?: string;
}): PortAllocation[] {
  const registry = loadRegistry();

  let allocations = registry.allocations;

  if (filters?.project) {
    allocations = allocations.filter((a) => a.project === filters.project);
  }

  if (filters?.type) {
    allocations = allocations.filter((a) => a.type === filters.type);
  }

  return allocations.sort((a, b) => a.port - b.port);
}

export function getStatus(): {
  types: Record<
    string,
    { available: number; used: number; next: number | null }
  >;
} {
  const config = loadConfig();
  const registry = loadRegistry();

  const usedPorts = new Set([
    ...registry.allocations.map((a) => a.port),
    ...registry.reservations.map((r) => r.port),
  ]);

  const types: Record<
    string,
    { available: number; used: number; next: number | null }
  > = {};

  for (const [typeName, range] of Object.entries(config.ranges)) {
    const total = range.end - range.start + 1;
    const used = registry.allocations.filter((a) => a.type === typeName).length;
    const available = total - used;

    let next: number | null = null;
    for (let p = range.start; p <= range.end; p++) {
      if (!usedPorts.has(p)) {
        next = p;
        break;
      }
    }

    types[typeName] = { available, used, next };
  }

  return { types };
}

export async function reservePort(port: number, reason: string): Promise<void> {
  return await LockManager.withRegistryLock((registry) => {
    // Check if port is already allocated or reserved
    const allocated = registry.allocations.find((a) => a.port === port);
    if (allocated) {
      throw new Error(
        `Port ${port} is already allocated to ${allocated.project}/${allocated.service}`
      );
    }

    const reserved = registry.reservations.find((r) => r.port === port);
    if (reserved) {
      throw new Error(`Port ${port} is already reserved: ${reserved.reason}`);
    }

    registry.reservations.push({
      port,
      reason,
      reservedAt: new Date().toISOString(),
    });
  });
}

export async function unreservePort(port: number): Promise<boolean> {
  return await LockManager.withRegistryLockConditional((registry) => {
    const before = registry.reservations.length;

    registry.reservations = registry.reservations.filter(
      (r) => r.port !== port
    );

    const unreserved = before > registry.reservations.length;

    return {
      result: unreserved,
      shouldSave: unreserved, // Only save if something was actually unreserved
    };
  });
}

export function listReservations(): Array<{
  port: number;
  reason: string;
  reservedAt: string;
}> {
  const registry = loadRegistry();
  return [...registry.reservations];
}
