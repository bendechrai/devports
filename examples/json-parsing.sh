#!/bin/bash
# =============================================================================
# Example: JSON output parsing with jq
# =============================================================================

set -e

PROJECT="example-json"

echo "🎯 JSON parsing example"
echo ""

# Allocate with JSON output
echo "1️⃣  Allocating with JSON output..."
JSON=$(devports allocate "$PROJECT" postgres --type postgres --json)
echo "$JSON" | jq '.'
echo ""

# Parse specific fields
PORT=$(echo "$JSON" | jq -r '.port')
TYPE=$(echo "$JSON" | jq -r '.type')
echo "   Parsed - Port: $PORT, Type: $TYPE"
echo ""

# List as JSON
echo "2️⃣  List all allocations as JSON..."
devports list --json | jq '.[] | {project, service, port}'
echo ""

# Status as JSON
echo "3️⃣  Status as JSON..."
devports status --json | jq '.postgres'
echo ""

# Cleanup
echo "4️⃣  Cleanup..."
devports release "$PROJECT" --all --json | jq '.'
echo ""

echo "✅ Example complete!"
