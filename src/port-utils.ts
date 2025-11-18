import { createConnection } from 'net';

/**
 * Check if a port is actually in use (not just allocated by devports)
 */
export function checkPortInUse(
  port: number,
  host = 'localhost'
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      // Connection successful means port is in use
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      // Connection failed means port is available
      resolve(false);
    });

    // Set timeout to avoid hanging
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Find the next available port in a range that's not in actual use
 */
export async function findAvailablePort(
  start: number,
  end: number,
  usedPorts: Set<number>,
  host = 'localhost'
): Promise<number | null> {
  for (let port = start; port <= end; port++) {
    if (usedPorts.has(port)) {
      continue; // Skip devports-allocated ports
    }

    const inUse = await checkPortInUse(port, host);
    if (!inUse) {
      return port;
    }
  }
  return null;
}
