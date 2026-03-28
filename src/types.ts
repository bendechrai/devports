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

