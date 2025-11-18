# Docker Integration with devports

This guide shows how to use devports with Docker to eliminate port conflicts and container naming issues when working with multiple worktrees.

## The Problem

When creating multiple git worktrees for the same project, you encounter two main Docker issues:

1. **Port conflicts**: Multiple worktrees try to bind the same host ports
2. **Container naming conflicts**: Docker containers have the same names across worktrees

## The Solution

devports solves this with:

- **Template-based port allocation**: Only port-map what needs host access
- **Post-hooks**: Automatically update container names
- **Environment variables**: Dynamic configuration without file modification

## Basic Example

### Before: Problematic Setup

**docker-compose.yml (causes conflicts):**

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    container_name: myproject-db
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password

  api:
    build: .
    container_name: myproject-api
    ports:
      - '3000:3000'
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/mydb
```

**Problems:**

- Port 5432 conflicts between worktrees
- Port 3000 conflicts between worktrees
- Container names `myproject-db` and `myproject-api` conflict

### After: devports Solution

**1. Create `.env.devports` template:**

```bash
# .env.devports
DEVPORTS_PROJECT_NAME=myproject

# Internal Docker networking (stays the same)
DATABASE_URL=postgresql://user:password@db:5432/mydb
API_URL=http://api:3000

# Port variables for docker-compose.yml
DATABASE_PORT={devports:postgres:database}
API_PORT={devports:api:api-server}

# External tool access (gets port-mapped)
MCP_DATABASE_URL=postgresql://readonly:password@localhost:${DATABASE_PORT}/mydb
EXTERNAL_API_URL=http://localhost:${API_PORT}
```

**2. Update docker-compose.yml to use environment variables:**

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    container_name: ${DEVPORTS_PROJECT_NAME}-db
    ports:
      - '${DATABASE_PORT}:5432'
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password

  api:
    build: .
    container_name: ${DEVPORTS_PROJECT_NAME}-api
    ports:
      - '${API_PORT}:3000'
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/mydb
```

**3. Create post-hook for automatic container naming:**

```bash
mkdir -p .devports/hooks
cp examples/docker-post-hook.sh .devports/hooks/post-worktree
chmod +x .devports/hooks/post-worktree
```

## Advanced Multi-Database Example

### Complex Project Structure

**Before: Multiple database conflicts**

```yaml
# docker-compose.yml (problematic)
version: '3.8'
services:
  users-db:
    image: postgres:15
    container_name: users-database
    ports:
      - '5432:5432'

  orders-db:
    image: postgres:15
    container_name: orders-database
    ports:
      - '5433:5432'

  redis:
    image: redis:7
    container_name: cache-redis
    ports:
      - '6379:6379'

  api:
    build: ./api
    container_name: main-api
    ports:
      - '3000:3000'
    environment:
      USERS_DB_URL: postgresql://user:pass@users-db:5432/users
      ORDERS_DB_URL: postgresql://user:pass@orders-db:5432/orders
      REDIS_URL: redis://redis:6379
```

### After: devports Template Solution

**1. Create comprehensive `.env.devports`:**

```bash
# .env.devports
DEVPORTS_PROJECT_NAME={DEVPORTS_PROJECT_NAME}

# Internal Docker networking (unchanged)
USERS_DB_URL=postgresql://user:pass@users-db:5432/users
ORDERS_DB_URL=postgresql://user:pass@orders-db:5432/orders
REDIS_URL=redis://redis:6379

# Port variables for docker-compose.yml
USERS_DB_PORT={devports:postgres:users-db}
ORDERS_DB_PORT={devports:postgres:orders-db}
CACHE_PORT={devports:redis:cache}
API_PORT={devports:api:main-api}

# External tool access (port-mapped for MCP servers, debugging tools, etc.)
MCP_USERS_DB_URL=postgresql://readonly:pass@localhost:${USERS_DB_PORT}/users
MCP_ORDERS_DB_URL=postgresql://readonly:pass@localhost:${ORDERS_DB_PORT}/orders
DEBUG_REDIS_URL=redis://localhost:${CACHE_PORT}/0
EXTERNAL_API_URL=http://localhost:${API_PORT}

# Development URLs using project name
TAILSCALE_URL={DEVPORTS_PROJECT_NAME}.tail1234.ts.net
NGROK_URL={DEVPORTS_PROJECT_NAME}.ngrok-free.app
```

**2. Update docker-compose.yml:**

```yaml
version: '3.8'
services:
  users-db:
    image: postgres:15
    container_name: ${DEVPORTS_PROJECT_NAME}-users-db
    ports:
      - '${USERS_DB_PORT}:5432'
    environment:
      POSTGRES_DB: users
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  orders-db:
    image: postgres:15
    container_name: ${DEVPORTS_PROJECT_NAME}-orders-db
    ports:
      - '${ORDERS_DB_PORT}:5432'
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  redis:
    image: redis:7
    container_name: ${DEVPORTS_PROJECT_NAME}-redis
    ports:
      - '${CACHE_PORT}:6379'

  api:
    build: ./api
    container_name: ${DEVPORTS_PROJECT_NAME}-api
    ports:
      - '${API_PORT}:3000'
    environment:
      USERS_DB_URL: postgresql://user:pass@users-db:5432/users
      ORDERS_DB_URL: postgresql://user:pass@orders-db:5432/orders
      REDIS_URL: redis://redis:6379
```

**3. Worktree creation results:**

```bash
# Create worktree
devports worktree add ../feature-payments -b feature/payment-system

# Results in ../feature-payments/.env:
DEVPORTS_PROJECT_NAME=feature-payments

# Internal URLs (unchanged)
USERS_DB_URL=postgresql://user:pass@users-db:5432/users
ORDERS_DB_URL=postgresql://user:pass@orders-db:5432/orders
REDIS_URL=redis://redis:6379

# External URLs (with allocated ports)
MCP_USERS_DB_URL=postgresql://readonly:pass@localhost:5434/users
MCP_ORDERS_DB_URL=postgresql://readonly:pass@localhost:5435/orders
DEBUG_REDIS_URL=redis://localhost:6380
EXTERNAL_API_URL=http://localhost:3001

# Dynamic URLs
TAILSCALE_URL=feature-payments.tail1234.ts.net
NGROK_URL=feature-payments.ngrok-free.app

# Port variables for convenience
USERS_DB_PORT=5434
ORDERS_DB_PORT=5435
CACHE_PORT=6380
API_PORT=3001
```

## Post-Hook Examples

### Basic Container Naming Hook

**`.devports/hooks/post-worktree`:**

```bash
#!/bin/bash
cd "$DEVPORTS_WORKTREE_PATH"

if [ -f docker-compose.yml ]; then
    echo "🐳 Updating container names with prefix: $DEVPORTS_PROJECT_NAME"

    # Backup original
    cp docker-compose.yml docker-compose.yml.bak

    # Update container names
    sed -i "s/container_name: \([^$]*\)/container_name: ${DEVPORTS_PROJECT_NAME}-\1/g" docker-compose.yml

    echo "✅ Container names updated"
fi
```

### Advanced Hook with Multiple Files

```bash
#!/bin/bash
set -e
cd "$DEVPORTS_WORKTREE_PATH"

echo "🐳 Setting up Docker environment for: $DEVPORTS_PROJECT_NAME"

# Update docker-compose.yml
if [ -f docker-compose.yml ]; then
    cp docker-compose.yml docker-compose.yml.bak
    sed -i "s/container_name: \([^$]*\)/container_name: ${DEVPORTS_PROJECT_NAME}-\1/g" docker-compose.yml
fi

# Update docker-compose.override.yml
if [ -f docker-compose.override.yml ]; then
    cp docker-compose.override.yml docker-compose.override.yml.bak
    sed -i "s/container_name: \([^$]*\)/container_name: ${DEVPORTS_PROJECT_NAME}-\1/g" docker-compose.override.yml
fi

# Create a docker-compose alias script
cat > docker-up.sh << EOF
#!/bin/bash
# Custom docker-compose script for worktree: $DEVPORTS_PROJECT_NAME
docker-compose --project-name $DEVPORTS_PROJECT_NAME up -d "\$@"
EOF
chmod +x docker-up.sh

# Create cleanup script
cat > docker-down.sh << EOF
#!/bin/bash
# Cleanup script for worktree: $DEVPORTS_PROJECT_NAME
docker-compose --project-name $DEVPORTS_PROJECT_NAME down "\$@"
EOF
chmod +x docker-down.sh

echo "✅ Docker environment configured"
echo "💡 Use ./docker-up.sh to start containers"
echo "💡 Use ./docker-down.sh to stop containers"
```

## Best Practices

### 1. Port Allocation Strategy

**Only port-map what needs host access:**

- Database connections for MCP servers
- API endpoints for testing tools
- Redis/cache for debugging
- Monitoring endpoints

**Keep internal networking unchanged:**

- Service-to-service communication
- Database connections from your app
- Message queue connections

### 2. Container Naming

**Use environment variables in docker-compose.yml:**

```yaml
container_name: ${DEVPORTS_PROJECT_NAME}-service-name
```

**Or use post-hooks for automatic updates:**

- More flexible for complex scenarios
- Can handle multiple files
- Enables custom logic

### 3. Environment Variables

**Naming convention:**

```bash
# Internal (unchanged)
DATABASE_URL=postgresql://user:pass@db:5432/mydb

# External (port-mapped)
MCP_DATABASE_URL=postgresql://readonly:pass@localhost:{devports:postgres:database}/mydb

# Convenience
DB_PORT=5433  # Added automatically
```

## Migration Guide

### Step 1: Create Template

1. Copy your current `.env` to `.env.devports`
2. Replace localhost port numbers with `{devports:type:service-name}` patterns
3. Add `DEVPORTS_PROJECT_NAME=yourproject` with your actual project name

### Step 2: Update Docker Compose

1. Add `${DEVPORTS_PROJECT_NAME}` to container names
2. Use `${SERVICE_PORT}` for port mappings
3. Test with your current `.env`

### Step 3: Add Post-Hook (Optional)

1. Copy `examples/docker-post-hook.sh` to `.devports/hooks/post-worktree`
2. Make executable: `chmod +x .devports/hooks/post-worktree`
3. Customize for your specific needs

### Step 4: Test Worktree Creation

```bash
# Test the setup
devports worktree add ../test-worktree -b test/devports-setup

# Verify results
cd ../test-worktree
cat .env
docker-compose config  # Check resolved configuration
```

### Step 5: Clean Up

```bash
# Remove test worktree
devports worktree remove ../test-worktree
```

## Troubleshooting

### Common Issues

**Container name conflicts despite using devports:**

- Check if `.env.devports` template exists
- Verify post-hook is executable: `ls -la .devports/hooks/post-worktree`
- Run worktree command with `--post-hook` to specify custom hook

**Port mapping not working:**

- Ensure `.env.devports` uses `{devports:type:service-name}` syntax
- Check that docker-compose.yml uses `${SERVICE_PORT}` variables
- Verify .env file in worktree has the port variables

**Template not being used:**

- File must be named exactly `.env.devports`
- Use `--template` option to specify custom template file
- Check template syntax with `{devports:type:service-name}` patterns

### Debug Commands

```bash
# Check what services would be detected
devports worktree add ../debug-test -b debug --json

# Verify template parsing
cat .env.devports  # Check template syntax

# Test docker-compose with resolved variables
cd worktree && docker-compose config
```

## Examples Repository

See `/examples` directory for complete working examples:

- `examples/.env.devports` - Multi-service template
- `examples/docker-post-hook.sh` - Container naming hook
- `examples/docker-compose.yml` - Environment variable usage

## Integration with Other Tools

### MCP Servers

Perfect for database MCP servers that need host port access:

```bash
MCP_DATABASE_URL=postgresql://readonly:pass@localhost:{devports:postgres:main-db}/mydb
```

### Tailscale Funnel

Dynamic subdomain generation:

```bash
FUNNEL_DOMAIN={DEVPORTS_PROJECT_NAME}.tail1234.ts.net
```

### Development Tools

Consistent URLs across worktrees:

```bash
GRAFANA_URL=http://localhost:{devports:app:monitoring}/
PROMETHEUS_URL=http://localhost:{devports:app:metrics}/metrics
```
