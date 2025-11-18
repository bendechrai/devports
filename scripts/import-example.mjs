#!/usr/bin/env node

/**
 * Example: Import existing port allocations into devports
 *
 * If you have existing manual port assignments, you can import them
 * by copying this script, editing it, and running it.
 *
 * This preserves your existing port numbers instead of auto-allocating new ones.
 */

import { writeFileSync } from 'fs';
import { loadConfig, loadRegistry, ensureConfigDir } from '../dist/config.js';

ensureConfigDir();

/**
 * Valid port types (must match one of these):
 * - 'postgres'  (5432-5499)
 * - 'mysql'     (3306-3399)
 * - 'redis'     (6379-6399)
 * - 'api'       (3000-3099)
 * - 'app'       (5000-5999)
 * - 'custom'    (8000-8999)
 */

// EDIT THIS: Add your existing allocations
const EXISTING_ALLOCATIONS = [
  // Example format:
  // { port: 5432, project: 'myproject', service: 'postgres', type: 'postgres' },
  // { port: 3001, project: 'myproject', service: 'api', type: 'api' },
  // { port: 5433, project: 'another-project', service: 'db', type: 'postgres' },
];

console.log('📥 Importing existing port allocations...\n');

if (EXISTING_ALLOCATIONS.length === 0) {
  console.log('⚠️  No allocations defined in this script.');
  console.log('   Copy this file and add your existing ports.');
  console.log('\nExample:');
  console.log(
    '  { port: 5432, project: "myapp", service: "postgres", type: "postgres" },'
  );
  console.log(
    '  { port: 3001, project: "myapp", service: "api", type: "api" },'
  );
  console.log('\nValid types: postgres, mysql, redis, api, app, custom');
  process.exit(0);
}

const config = loadConfig();
const registry = loadRegistry();

// Add allocations with current timestamp
const now = new Date().toISOString();
let imported = 0;
let skipped = 0;

for (const alloc of EXISTING_ALLOCATIONS) {
  // Validate type
  if (!config.ranges[alloc.type]) {
    console.log(
      `❌ Skipping ${alloc.project}/${alloc.service} - invalid type "${alloc.type}"`
    );
    console.log(`   Valid types: ${Object.keys(config.ranges).join(', ')}`);
    skipped++;
    continue;
  }

  // Check if already exists
  const exists = registry.allocations.find(
    (a) =>
      a.port === alloc.port ||
      (a.project === alloc.project && a.service === alloc.service)
  );

  if (exists) {
    console.log(
      `⚠️  Skipping ${alloc.project}/${alloc.service} - already allocated`
    );
    skipped++;
    continue;
  }

  registry.allocations.push({
    ...alloc,
    allocatedAt: now,
  });

  console.log(
    `✅ Imported ${alloc.project}/${alloc.service} → port ${alloc.port} (${alloc.type})`
  );
  imported++;
}

// Save the updated registry
if (imported > 0) {
  writeFileSync(config.registryPath, JSON.stringify(registry, null, 2));
  console.log(`\n✅ Imported ${imported} allocation(s)`);
} else {
  console.log('\n⚠️  No new allocations imported');
}

if (skipped > 0) {
  console.log(`   Skipped ${skipped} allocation(s)`);
}

console.log('\nRun "devports list" to verify your allocations.');
