#!/bin/bash
# Example post-worktree hook for Docker container naming
# Place this at .devports/hooks/post-worktree in your project

set -e

cd "$DEVPORTS_WORKTREE_PATH"

echo "🐳 Updating Docker configuration for project: $DEVPORTS_PROJECT_NAME"

# Update docker-compose.yml container names
if [ -f docker-compose.yml ]; then
    echo "📝 Updating container names in docker-compose.yml"

    # Backup original file
    cp docker-compose.yml docker-compose.yml.bak

    # Replace container_name values with prefixed versions
    # This handles both quoted and unquoted container names
    sed -i.tmp -E "s/container_name:[ ]*(['\"]?)([^'\"]+)(['\"]?)/container_name: \1${DEVPORTS_PROJECT_NAME}-\2\3/g" docker-compose.yml

    # Alternative approach using yq if available
    # if command -v yq &> /dev/null; then
    #     yq eval ".services.*.container_name = \"${DEVPORTS_PROJECT_NAME}-\" + .services.*.container_name" -i docker-compose.yml
    # fi

    # Clean up temp file
    rm -f docker-compose.yml.tmp

    echo "✅ Updated container names with prefix: ${DEVPORTS_PROJECT_NAME}-"
fi

# Update docker-compose.override.yml if it exists
if [ -f docker-compose.override.yml ]; then
    echo "📝 Updating container names in docker-compose.override.yml"

    cp docker-compose.override.yml docker-compose.override.yml.bak
    sed -i.tmp -E "s/container_name:[ ]*(['\"]?)([^'\"]+)(['\"]?)/container_name: \1${DEVPORTS_PROJECT_NAME}-\2\3/g" docker-compose.override.yml
    rm -f docker-compose.override.yml.tmp
fi

# Update any Dockerfile references if needed
if [ -f Dockerfile ]; then
    echo "📝 Dockerfile found - consider updating any hardcoded container references"
fi

echo "🎉 Docker configuration updated successfully!"
echo "💡 Your containers will now be prefixed with: ${DEVPORTS_PROJECT_NAME}-"
echo "💡 Port mappings use environment variables from .env file"