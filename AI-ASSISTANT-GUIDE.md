# devports- CLI Reference for AI Assistants

This document is optimized for AI coding assistants (Claude Code, Cursor, GitHub Copilot, etc.) to understand and use devports effectively.

## Quick Reference

devports is a CLI tool for managing port allocations across development projects. All commands support `--json` and `--quiet` flags for automation.

### Installation Check

```bash
# Check if devports is installed
which devports

# Show version and help
devports --version
devports --help

# Install shell completion for better UX
devports completion zsh --install  # macOS default
devports completion bash --install # Linux default
```

### Core Commands

#### 1. Allocate a Port

```bash
# Basic allocation (defaults to postgres type)
devports allocate <project> <service>

# With specific type
devports allocate <project> <service> --type <type>

# Quiet mode (returns only port number)
devports allocate <project> <service> --quiet

# JSON output
devports allocate <project> <service> --json
```

**Exit codes**: 0 = success, 1 = failure

**Example outputs**:

```bash
# Normal mode
$ devports allocate myapp postgres --type postgres
✅ Allocated port 5432 for myapp/postgres

# Quiet mode
$ devports allocate myapp postgres --type postgres --quiet
5432

# JSON mode
$ devports allocate myapp postgres --type postgres --json
{"port":5432,"project":"myapp","service":"postgres","type":"postgres"}
```

#### 2. Release a Port

```bash
# Release specific service
devports release <project> <service>

# Release all ports for a project
devports release <project> --all

# Release by port number
devports release <port> --port

# Quiet mode (no output, exit code indicates success)
devports release <project> <service> --quiet
```

**Exit codes**: 0 = port(s) released, 1 = no ports found or error

#### 3. List Allocations

```bash
# List all allocations
devports list

# Filter by project
devports list --project <project>

# Filter by type
devports list --type <type>

# Quiet mode (just port numbers)
devports list --quiet

# JSON output
devports list --json
```

#### 4. Check Status

```bash
# Show availability by type
devports status

# Quiet mode (type:port pairs)
devports status --quiet

# JSON output
devports status --json
```

**Quiet mode output**:

```
postgres:5449
mysql:3306
api:3005
```

#### 5. Check Port Availability

```bash
# Check if port is available
devports check <port>

# Quiet mode (exit code only)
devports check <port> --quiet

# JSON output
devports check <port> --json
```

**Exit codes**: 0 = available, 1 = in use

#### 6. Get Info

```bash
# Show configuration and stats
devports info

# JSON output
devports info --json
```

## Port Types and Ranges

Default port ranges (configurable in `~/.config/devports/config.json`):

| Type     | Range     | Usage                          |
| -------- | --------- | ------------------------------ |
| postgres | 5434-5499 | PostgreSQL databases           |
| mysql    | 3308-3399 | MySQL/MariaDB databases        |
| redis    | 6381-6399 | Redis instances                |
| api      | 3002-3099 | API servers (Express, FastAPI) |
| app      | 5002-5999 | Web apps (React, Vue, etc.)    |
| custom   | 8002-8999 | Custom services                |

> **Why these ranges?** Starting points are offset from standard ports (postgres: 5432, mysql: 3306, redis: 6379, api: 3000, etc.) to prevent conflicts when developers run services directly on the host alongside devports-managed projects. Port 8080 is reserved by default as it's commonly used for development servers.

## Automation Patterns

### Pattern 1: Allocate and Use in Script

```bash
#!/bin/bash
PROJECT=$(basename $(pwd))

# Allocate port (quiet mode returns just the number)
POSTGRES_PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)

# Use in .env
echo "DATABASE_PORT=$POSTGRES_PORT" >> .env

# Use in Docker Compose
sed -i "s/5432:5432/${POSTGRES_PORT}:5432/" docker-compose.yml
```

### Pattern 2: Check Before Allocating

```bash
#!/bin/bash
if devports list --project myapp --quiet | grep -q .; then
  echo "Ports already allocated"
  devports list --project myapp
else
  echo "Allocating ports..."
  devports allocate myapp postgres --type postgres --quiet
fi
```

### Pattern 3: Cleanup on Exit

```bash
#!/bin/bash
PROJECT="temp-$RANDOM"

# Allocate
PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)

# Cleanup on exit
trap "devports release $PROJECT --all --quiet" EXIT

# Do work...
echo "Using port $PORT"
```

### Pattern 4: Conditional Allocation

```bash
# Check if port is available
if devports check 5432 --quiet; then
  # Manually reserve it
  devports reserve 5432 "Production database"
else
  # Get next available
  PORT=$(devports allocate myapp postgres --type postgres --quiet)
fi
```

### Pattern 5: JSON Parsing

```bash
# Get allocation details as JSON
JSON=$(devports allocate myapp api --type api --json)

# Parse with jq
PORT=$(echo "$JSON" | jq -r '.port')
TYPE=$(echo "$JSON" | jq -r '.type')

echo "Allocated $TYPE port: $PORT"
```

### Pattern 6: Multiple Services

```bash
#!/bin/bash
PROJECT="myapp"

# Allocate multiple services
PG_PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)
API_PORT=$(devports allocate "$PROJECT" api --type api --quiet)
APP_PORT=$(devports allocate "$PROJECT" app --type app --quiet)

# Write to .env
cat > .env <<EOF
DATABASE_PORT=$PG_PORT
API_PORT=$API_PORT
APP_PORT=$APP_PORT
EOF
```

## Error Handling

### Exit Codes

- **0**: Success
- **1**: Failure (port in use, not found, invalid input, etc.)

### JSON Error Format

```json
{ "error": "Port 5432 already allocated to myapp/postgres" }
```

### Handling Errors in Scripts

```bash
# Check exit code
if devports allocate myapp postgres --type postgres --quiet; then
  echo "Success"
else
  echo "Failed to allocate port" >&2
  exit 1
fi

# Or capture output
if PORT=$(devports allocate myapp postgres --type postgres --quiet 2>/dev/null); then
  echo "Allocated port: $PORT"
else
  echo "Allocation failed"
fi
```

## Common Use Cases for AI Assistants

### Use Case 1: Setting Up a New Project

```bash
# When creating a new project, allocate all needed ports
PROJECT_NAME="new-app"
devports allocate "$PROJECT_NAME" postgres --type postgres --quiet >> .env
devports allocate "$PROJECT_NAME" redis --type redis --quiet >> .env
devports allocate "$PROJECT_NAME" api --type api --quiet >> .env
```

### Use Case 2: Git Worktree Setup

```bash
# Create worktree with unique ports
WORKTREE="feature-auth"
git worktree add "../$WORKTREE" -b "$WORKTREE"

cd "../$WORKTREE"
PORT=$(devports allocate "$WORKTREE" postgres --type postgres --quiet)
echo "DATABASE_PORT=$PORT" > .env
```

### Use Case 3: Environment File Generation

```bash
# Allocate ports and create .env file
DB_PORT=$(devports allocate myapp db --quiet)
API_PORT=$(devports allocate myapp api --type api --quiet)

# Generate .env file for your application
cat > .env <<EOF
DEVPORTS_PROJECT_NAME=myapp
DATABASE_PORT=$DB_PORT
API_PORT=$API_PORT
DATABASE_URL=postgresql://user:password@localhost:$DB_PORT/mydb
EOF
```

### Use Case 4: CI/CD Pipeline

```bash
# In CI, allocate ephemeral ports for testing
TEST_RUN_ID="ci-$GITHUB_RUN_ID"

DB_PORT=$(devports allocate "$TEST_RUN_ID" postgres --type postgres --quiet)
export DATABASE_URL="postgresql://user:pass@localhost:$DB_PORT/testdb"

# Run tests...

# Cleanup
devports release "$TEST_RUN_ID" --all --quiet
```

### Use Case 5: Development Environment Check

```bash
# Check what ports are in use for a project
if devports list --project myapp --json | jq -e 'length > 0' > /dev/null; then
  echo "Project has allocated ports:"
  devports list --project myapp
else
  echo "No ports allocated. Run setup script."
fi
```

## Configuration

### Config File Location

`~/.config/devports/config.json`

### Registry File Location

`~/.config/devports/ports.json`

### Example Config

```json
{
  "ranges": {
    "postgres": { "start": 5434, "end": 5499 },
    "mysql": { "start": 3308, "end": 3399 },
    "redis": { "start": 6381, "end": 6399 },
    "api": { "start": 3002, "end": 3099 },
    "app": { "start": 5002, "end": 5999 },
    "custom": { "start": 8002, "end": 8999 }
  },
  "registryPath": "~/.config/devports/ports.json"
}
```

## Troubleshooting for AI Assistants

### Issue: "devports command not found"

```bash
# Check if installed globally
npm list -g devports

# If not, install
npm install -g devports

# Or use npx
npx devports --version
```

### Issue: "Port already allocated"

```bash
# Find what's using it
devports list --json | jq '.[] | select(.port == 5432)'

# Release if appropriate
devports release <project> <service>
```

### Issue: "No available ports"

```bash
# Check status
devports status --json

# List all to see what's in use
devports list --type postgres --json
```

## Best Practices for Automation

1. **Always use --quiet for scripting**: Returns just the value needed
2. **Always use --json for parsing**: Structured output for scripts
3. **Check exit codes**: Don't assume success
4. **Use unique project names**: Avoid conflicts (e.g., worktree names)
5. **Clean up on exit**: Use traps or try/finally
6. **Validate inputs**: Check port numbers are integers
7. **Use meaningful service names**: Makes `devports list` clearer

## Quick Decision Tree

```
Need a port?
├─ Know which port? → devports check <port> --quiet
│  ├─ Available? → devports reserve <port> "reason"
│  └─ In use? → devports allocate <project> <service> --quiet
│
├─ Need next available? → devports allocate <project> <service> --quiet
│
└─ Cleaning up?
   ├─ One service? → devports release <project> <service> --quiet
   └─ All ports? → devports release <project> --all --quiet
```

## LLM Instruction Template

When an AI assistant needs to use devports follow this pattern:

1. **Check if installed**: `devports --version`
2. **Use --quiet for values**: `PORT=$(devports allocate ...)`
3. **Use --json for parsing**: Parse with jq/python/etc
4. **Check exit codes**: Handle errors appropriately
5. **Clean up**: Always release when done

This ensures reliable, scriptable usage across different AI coding environments.
