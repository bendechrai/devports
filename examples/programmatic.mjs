#!/usr/bin/env node

/**
 * Example: Programmatic usage of devports in Node.js
 */

import {
  allocatePort,
  releasePort,
  listAllocations,
  getStatus,
} from 'devports';

async function main() {
  console.log('🎯 Programmatic devports usage example\n');

  const project = 'example-node';

  try {
    // 1. Allocate a port
    console.log('1️⃣  Allocating PostgreSQL port...');
    const pgPort = await allocatePort(project, 'postgres', 'postgres');
    console.log(`   Allocated: ${pgPort}\n`);

    // 2. Allocate another port
    console.log('2️⃣  Allocating API port...');
    const apiPort = await allocatePort(project, 'api', 'api');
    console.log(`   Allocated: ${apiPort}\n`);

    // 3. List allocations
    console.log('3️⃣  Listing all allocations for project...');
    const allocations = listAllocations({ project });
    console.log(`   Found ${allocations.length} allocation(s):`);
    allocations.forEach((a) => {
      console.log(`   - ${a.service}: port ${a.port}`);
    });
    console.log('');

    // 4. Get status
    console.log('4️⃣  Getting port status...');
    const status = getStatus();
    console.log('   Port availability:');
    for (const [type, stats] of Object.entries(status.types)) {
      console.log(
        `   - ${type}: ${stats.available} available, next: ${stats.next || 'none'}`
      );
    }
    console.log('');

    // 5. Release allocations
    console.log('5️⃣  Releasing allocations...');
    const released = await releasePort(project, undefined, true);
    console.log(`   Released ${released} port(s)\n`);

    console.log('✅ Example complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
