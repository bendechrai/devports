/**
 * Completion data providers for shell completion system
 */

import { listAllocations } from '../port-manager.js';
import { VALID_PORT_TYPES } from '../types.js';

/**
 * Get all project names for completion
 */
export function getProjectsForCompletion(): string[] {
  try {
    const allocations = listAllocations();
    const projects = new Set(allocations.map((a) => a.project));
    return Array.from(projects).sort();
  } catch {
    return [];
  }
}

/**
 * Get all service names for a specific project
 */
export function getServicesForCompletion(project: string): string[] {
  try {
    const allocations = listAllocations({ project });
    const services = new Set(allocations.map((a) => a.service));
    return Array.from(services).sort();
  } catch {
    return [];
  }
}

/**
 * Get all valid service types for completion
 */
export function getServiceTypesForCompletion(): string[] {
  return VALID_PORT_TYPES.slice();
}
