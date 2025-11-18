export interface PortRange {
  start: number;
  end: number;
}

export interface Config {
  ranges: Record<string, PortRange>;
  registryPath: string;
}

export interface PortAllocation {
  port: number;
  project: string;
  service: string;
  type: string;
  allocatedAt: string;
  note?: string;
}

export interface Registry {
  allocations: PortAllocation[];
  reservations: {
    port: number;
    reason: string;
    reservedAt: string;
  }[];
}

// Valid port types - exported for validation
export const VALID_PORT_TYPES = [
  'postgres',
  'mysql',
  'redis',
  'api',
  'app',
  'custom',
] as const;

export type PortType = (typeof VALID_PORT_TYPES)[number];

// Helper to validate port type
export function isValidPortType(type: string): type is PortType {
  return VALID_PORT_TYPES.includes(type as PortType);
}

// Helper to get valid types as string
export function getValidPortTypes(): string {
  return VALID_PORT_TYPES.join(', ');
}
