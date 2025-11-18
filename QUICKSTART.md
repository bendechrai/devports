# Quick Start Guide

## Installation

### Global (Recommended)

```bash
npm install -g devports
devports --version
```

### Local (Per Project)

```bash
npm install --save-dev devports
npx devports --version
```

## First Use

```bash
# Allocate your first port
devports allocate myproject postgres --type postgres
# → ✅ Allocated port 5432 for myproject/postgres

# Check status
devports status

# List allocations
devports list

# Release when done
devports release myproject postgres
```

## Setup Your Project

For setting up a main repository clone, use the `setup` command:

```bash
# Create a template file first
cat > .env.devports <<EOF
DEVPORTS_PROJECT_NAME=myproject
DATABASE_URL=postgresql://user:pass@localhost:{devports:postgres:db}/myapp
API_PORT={devports:api:server}
API_URL=https://{devports:project}.example.com
EOF

# Run setup to allocate ports and generate .env
devports setup
# → ✅ Setting up myproject...
# → 📍 Detected services: db, server
# → 🔌 Allocated ports: db: 5432, server: 3000
# → 📝 Generated .env from .env.devports

# Check your new .env file
cat .env
# → DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
# → API_PORT=3000
```

The setup command:

- Only works in main repository clones (not worktrees)
- Detects services from template patterns `{devports:type:service-name}`
- Allocates ports automatically
- Auto-renders any `*.devports` files in your directory

## Import Existing Allocations (Optional)

If you have existing manual port assignments:

```bash
# Copy and edit the example script
cp node_modules/devports/scripts/import-example.mjs ./import-ports.mjs

# Edit import-ports.mjs - add your allocations like:
# { port: 5432, project: 'myapp', service: 'postgres', type: 'postgres' }

# Run the import
node import-ports.mjs

# Verify
devports list
```

## Common Usage Patterns

### Pattern 1: New Project Setup

```bash
PROJECT=$(basename $(pwd))

# Allocate needed ports
POSTGRES_PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)
API_PORT=$(devports allocate "$PROJECT" api --type api --quiet)

# Save to .env
cat > .env <<EOF
DATABASE_PORT=$POSTGRES_PORT
API_PORT=$API_PORT
EOF
```

### Pattern 2: Git Worktree

```bash
# Create worktree with unique ports
WORKTREE="feature-auth"
git worktree add "../$WORKTREE" -b "$WORKTREE"

cd "../$WORKTREE"
POSTGRES_PORT=$(devports allocate "$WORKTREE" postgres --type postgres --quiet)
echo "DATABASE_PORT=$POSTGRES_PORT" > .env

# Cleanup later
devports release "$WORKTREE" --all
git worktree remove "../$WORKTREE"
```

### Pattern 3: Check Before Using

```bash
# Check if port 5432 is free
if devports check 5432 --quiet; then
  echo "Port 5432 is available"
else
  echo "Port 5432 is in use, getting next available..."
  PORT=$(devports allocate myapp postgres --quiet)
fi
```

### Pattern 4: CI/CD

```bash
# Allocate ephemeral ports for testing
TEST_ID="ci-$BUILD_NUMBER"

DB_PORT=$(devports allocate "$TEST_ID" db --quiet)
export DATABASE_URL="postgresql://user:pass@localhost:$DB_PORT/test"

# Run tests...

# Cleanup
devports release "$TEST_ID" --all --quiet
```

## All Commands

```bash
# Allocate
devports allocate <project> <service> [--type <type>] [--quiet] [--json]

# Release
devports release <project> [service] [--all] [--quiet] [--json]
devports release <port> --port  # Release by port number

# List
devports list [--project <n>] [--type <type>] [--quiet] [--json]

# Status
devports status [--quiet] [--json]

# Check
devports check <port> [--quiet] [--json]

# Info
devports info [--json]

# Reserve
devports reserve <port> [reason]
devports unreserve <port>
```

## Flags

- `--quiet` / `-q`: Minimal output (for scripting)
- `--json`: JSON output (for parsing)
- `--type` / `-t`: Specify port type
- `--all` / `-a`: Apply to all services

## Port Types

| Type     | Range     |
| -------- | --------- |
| postgres | 5434-5499 |
| mysql    | 3308-3399 |
| redis    | 6381-6399 |
| api      | 3002-3099 |
| app      | 5002-5999 |
| custom   | 8002-8999 |

> **Note**: Ranges start above standard ports to avoid conflicts with development services running directly on the host. Port 8080 is reserved by default.

## Configuration

Files in `~/.config/devports`:

- `config.json` - Port ranges and settings
- `ports.json` - Current allocations

Edit these directly if needed.

## Troubleshooting

**Command not found:**

```bash
npm install -g devports
```

**Port already allocated:**

```bash
devports list
devports release <project> <service>
```

**No ports available:**

```bash
devports status
devports list --type postgres
```

## Next Steps

- See [README.md](./README.md) for detailed documentation
- See [AI-ASSISTANT-GUIDE.md](./AI-ASSISTANT-GUIDE.md) for automation patterns
- Run `devports--help` for command reference

## Getting Help

- GitHub Issues: https://github.com/bendechrai/devports/issues
- Documentation: https://github.com/bendechrai/devports
