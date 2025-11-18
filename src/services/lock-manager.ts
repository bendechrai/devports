/**
 * Lock management service for coordinating file access
 * Abstracts the common lock/unlock patterns used throughout the application
 */

import lockfile from 'proper-lockfile';
import { loadConfig, loadRegistry, saveRegistry } from '../config.js';
import type { Registry } from '../types.js';

/**
 * Configuration for lock operations
 */
export interface LockOptions {
  retries?: number;
  stale?: number;
}

/**
 * Default lock options used throughout the application
 */
const DEFAULT_LOCK_OPTIONS: LockOptions = {
  retries: 5,
  stale: 10000,
};

/**
 * Operation result that controls whether registry is saved
 */
export interface RegistryOperationResult<T> {
  result: T;
  shouldSave?: boolean;
}

/**
 * Lock manager for coordinating registry file access
 * Ensures thread-safe operations on the port registry
 */
export class LockManager {
  /**
   * Execute an operation with exclusive access to the registry file
   * Handles the complete lock/load/save/unlock cycle
   */
  static async withRegistryLock<T>(
    operation: (registry: Registry) => Promise<T> | T,
    options: LockOptions = DEFAULT_LOCK_OPTIONS
  ): Promise<T> {
    const config = loadConfig();

    // Ensure registry exists before locking
    loadRegistry();

    // Lock the registry file
    const release = await lockfile.lock(config.registryPath, {
      retries: options.retries,
      stale: options.stale,
    });

    try {
      // Load fresh registry data while holding the lock
      const registry = loadRegistry();

      // Execute the operation with the registry
      const result = await operation(registry);

      // Save the registry after the operation
      saveRegistry(registry);

      return result;
    } finally {
      // Always release the lock
      await release();
    }
  }

  /**
   * Execute an operation with conditional saving
   * Save registry only if the operation indicates it should be saved
   */
  static async withRegistryLockConditional<T>(
    operation: (
      registry: Registry
    ) => Promise<RegistryOperationResult<T>> | RegistryOperationResult<T>,
    options: LockOptions = DEFAULT_LOCK_OPTIONS
  ): Promise<T> {
    const config = loadConfig();

    // Ensure registry exists before locking
    loadRegistry();

    // Lock the registry file
    const release = await lockfile.lock(config.registryPath, {
      retries: options.retries,
      stale: options.stale,
    });

    try {
      // Load fresh registry data while holding the lock
      const registry = loadRegistry();

      // Execute the operation with the registry
      const operationResult = await operation(registry);

      // Save the registry only if requested
      if (operationResult.shouldSave !== false) {
        saveRegistry(registry);
      }

      return operationResult.result;
    } finally {
      // Always release the lock
      await release();
    }
  }

  /**
   * Execute a read-only operation with shared access to the registry
   * Loads registry without saving changes
   */
  static async withRegistryReadLock<T>(
    operation: (registry: Registry) => Promise<T> | T,
    options: LockOptions = DEFAULT_LOCK_OPTIONS
  ): Promise<T> {
    const config = loadConfig();

    // Ensure registry exists before locking
    loadRegistry();

    // Lock the registry file (even for reads to ensure consistency)
    const release = await lockfile.lock(config.registryPath, {
      retries: options.retries,
      stale: options.stale,
    });

    try {
      // Load fresh registry data while holding the lock
      const registry = loadRegistry();

      // Execute the read-only operation
      const result = await operation(registry);

      // No need to save for read-only operations
      return result;
    } finally {
      // Always release the lock
      await release();
    }
  }

  /**
   * Execute an operation with a custom file lock
   * Generic lock manager for other file operations
   */
  static async withFileLock<T>(
    filePath: string,
    operation: () => Promise<T> | T,
    options: LockOptions = DEFAULT_LOCK_OPTIONS
  ): Promise<T> {
    const release = await lockfile.lock(filePath, {
      retries: options.retries,
      stale: options.stale,
    });

    try {
      return await operation();
    } finally {
      await release();
    }
  }
}
