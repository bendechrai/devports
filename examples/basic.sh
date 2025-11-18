#!/bin/bash
# =============================================================================
# Example: Basic port allocation and cleanup
# =============================================================================

set -e

PROJECT="example-basic"

echo "🎯 Basic devports usage example"
echo ""

# Allocate a port
echo "1️⃣  Allocating PostgreSQL port..."
PG_PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)
echo "   Allocated: $PG_PORT"
echo ""

# Check the allocation
echo "2️⃣  Listing allocations..."
devports list --project "$PROJECT"
echo ""

# Check if a specific port is available
echo "3️⃣  Checking if port 5450 is available..."
if devports check 5450 --quiet; then
  echo "   ✅ Port 5450 is available"
else
  echo "   ❌ Port 5450 is in use"
fi
echo ""

# Release the port
echo "4️⃣  Releasing the allocation..."
devports release "$PROJECT" postgres --quiet
echo "   ✅ Released"
echo ""

echo "✅ Example complete!"
