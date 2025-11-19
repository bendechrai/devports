<h1 align="center">devports</h1>

<p align="center">
  <em>Automatic port allocation for multi-project development</em>
</p>

Stop manually tracking port numbers across projects, Docker containers, and git worktrees. `devports` automatically manages port allocations so you never have conflicts.

[![npm version](https://img.shields.io/npm/v/devports)](https://www.npmjs.com/package/devports)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

When working on multiple projects:

- ❌ Project A wants PostgreSQL on port 5432
- ❌ Project B also wants PostgreSQL on port 5432
- ❌ Manually tracking free ports is tedious and error-prone
- ❌ Git worktrees need unique ports but remembering which is hard
- ❌ Team members use different ports causing confusion

**devports solves this:**

- ✅ Automatically allocates the next available port
- ✅ Tracks all allocations in one place
- ✅ Type-aware (postgres, mysql, api, app, etc.)
- ✅ Works great with git worktrees
- ✅ Scriptable for automation
- ✅ Team-friendly with shared configuration

## Installation

```bash
npm install -g devports
```

Verify:

```bash
devports --version
```

### Platform Support

devports works on all major platforms:

- ✅ **macOS** - Full support including shell completion (zsh/bash)
- ✅ **Linux** - Full support including shell completion (bash/zsh)
- ✅ **Windows (WSL)** - Full support when running under WSL (recommended)
- ⚠️ **Windows (native)** - Core functionality works, but shell completion is not yet supported
  - PowerShell completion support is planned for a future release
  - Use WSL for the best experience on Windows

**Windows users:** We recommend using [WSL (Windows Subsystem for Linux)](https://learn.microsoft.com/en-us/windows/wsl/install) for full feature support including shell completion.

## Quick Start

```bash
# Allocate a PostgreSQL port
devports allocate myproject postgres --type postgres
# → ✅ Allocated port 5432 for myproject/postgres

# Allocate an API port
devports allocate myproject api --type api
# → ✅ Allocated port 3000 for myproject/api

# List all allocations
devports list

# Check what's available
devports status

# Release when done
devports release myproject postgres
```

## Usage

### Basic Commands

```bash
# Set up current directory (main clone only)
devports setup [--template <file>] [--force] [--skip-render]

# Allocate a port
devports allocate <project> <service> --type <type>

# Release port(s)
devports release <project> [service] [--all]

# List allocations
devports list [--project <name>] [--type <type>]

# Check availability
devports status
devports check <port>

# Render templates
devports render <file> [--output <file>]

# Manage .gitignore
devports gitignore [--preview]

# Show configuration
devports info
```

### Port Types

| Type     | Default Range | Usage                   |
| -------- | ------------- | ----------------------- |
| postgres | 5434-5499     | PostgreSQL databases    |
| mysql    | 3308-3399     | MySQL/MariaDB databases |
| redis    | 6381-6399     | Redis instances         |
| api      | 3002-3099     | API servers             |
| app      | 5002-5999     | Web applications        |
| custom   | 8002-8999     | Custom services         |

> **Note**: Port ranges start slightly above standard ports (postgres: 5432, mysql: 3306, redis: 6379, api: 3000, etc.) to avoid conflicts with development services running directly on the host. Port 8080 is reserved by default as it's commonly used for development servers.

Port ranges are fully customizable in `~/.config/devports/config.json`.

### Scripting & Automation

All commands support `--quiet` and `--json` for automation:

```bash
# Get just the port number
PORT=$(devports allocate myapp postgres --type postgres --quiet)
echo "Using port: $PORT"

# Get JSON output
devports allocate myapp api --type api --json
# → {"port":3001,"project":"myapp","service":"api","type":"api"}

# Check if port is available (exit code 0=yes, 1=no)
if devports check 5432 --quiet; then
  echo "Port 5432 is available"
fi
```

## Real-World Examples

### Shell Script Setup

```bash
#!/bin/bash
PROJECT=$(basename $(pwd))

# Allocate ports
POSTGRES_PORT=$(devports allocate "$PROJECT" postgres --type postgres --quiet)
API_PORT=$(devports allocate "$PROJECT" api --type api --quiet)

# Write to .env
cat > .env <<EOF
DATABASE_PORT=$POSTGRES_PORT
API_PORT=$API_PORT
DATABASE_URL=postgresql://user:pass@localhost:$POSTGRES_PORT/db
EOF

echo "✅ Ports allocated: PG=$POSTGRES_PORT, API=$API_PORT"
```

### Main Clone Setup

Use `devports setup` to initialize your main repository clone with port allocation and template processing:

```bash
# Basic setup (defaults to postgres if no template found)
devports setup

# Setup with custom template
devports setup --template .env.devports

# Force overwrite existing .env (creates .env.backup)
devports setup --force

# Skip auto-rendering of *.devports files
devports setup --skip-render
```

#### Template System

Create a `.env.devports` template file with `{devports:type:service-name}` placeholders:

```bash
# .env.devports
DEVPORTS_PROJECT_NAME=myproject
DATABASE_URL=postgresql://user:pass@localhost:{devports:postgres:db}/myapp
API_PORT={devports:api:server}
REDIS_URL=redis://localhost:{devports:redis:cache}
API_URL=https://{devports:project}-api.example.com
```

Running `devports setup` will:

1. Allocate ports for detected services (db, server, cache)
2. Process template and generate `.env` file
3. Auto-render any `*.devports` files found in the directory

Example auto-rendering:

```yaml
# docker-compose.yml.devports
services:
  db:
    image: postgres:15
    ports:
      - "{devports:postgres:db}:5432"
    container_name: {devports:project}-db

  app:
    build: .
    ports:
      - "{devports:api:server}:3000"
    container_name: {devports:project}-app
```

After `devports setup`, this becomes `docker-compose.yml` with actual ports and project name substituted.

### Git Worktree Integration

#### Basic Usage

```bash
# Create worktree with automatic port allocation
devports worktree add ../feature-auth -b feature/auth

# Remove worktree and release all ports
devports worktree remove ../feature-auth
```

#### Template-Based Allocation

Create a `.env.devports` template to control exactly what gets port-mapped:

```bash
# .env.devports template
DEVPORTS_PROJECT_NAME=myproject
MCP_DATABASE_URL=postgresql://user:pass@localhost:{devports:postgres:main-database}/mydb
API_URL=http://localhost:{devports:api:main-api}/api
```

Running `devports worktree add ../my-feature -b feature/branch` creates an `.env` file with actual ports allocated.

#### Auto-rendering \*.devports Files

After creating a worktree, devports automatically scans for and renders all `*.devports` files:

```bash
# If your project has these files:
docker-compose.yml.devports
config.json.devports
nginx.conf.devports

# After running: devports worktree add ../feature-payments -b feature/payments
# The worktree will contain:
docker-compose.yml    # ← rendered from docker-compose.yml.devports template
config.json          # ← rendered from config.json.devports template
nginx.conf           # ← rendered from nginx.conf.devports template
.env                 # ← generated from .env.devports template
```

This pattern allows you to:

- Keep templates in version control (`*.devports`)
- Auto-generate configuration files with allocated ports
- Use `devports gitignore` to prevent committing generated files

### Package.json Scripts

For worktree management (useful with local installations):

```json
{
  "scripts": {
    "worktree": "devports worktree",
    "ports": "devports list --project $(basename $(pwd))"
  }
}
```

Then run:

```bash
# Create worktree
npm run worktree -- add ../feature-auth -b feature/auth

# Check current project's ports
npm run ports
```

### Programmatic Usage (Node.js)

For CI/CD environments or tool integrations:

```javascript
import { allocatePort, listAllocations, checkPortInUse } from 'devports';

// CI/CD: Allocate ephemeral port for testing
const testRunId = `ci-${process.env.GITHUB_RUN_ID}`;
const dbPort = await allocatePort(testRunId, 'test-db', 'postgres');

// Tool integration: Check if port is actually available
const isInUse = await checkPortInUse(5432);
if (!isInUse) {
  console.log('Port 5432 is available for use');
}

// Development tools: List project ports
const projectPorts = listAllocations({ project: 'myapp' });
console.log('Current allocations:', projectPorts);
```

## Configuration

### Config File

Location: `~/.config/devports/config.json`

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

You can edit this file to customize port ranges or add new types.

### Registry File

Location: `~/.config/devports/ports.json`

```json
{
  "allocations": [
    {
      "port": 5432,
      "project": "myapp",
      "service": "postgres",
      "type": "postgres",
      "allocatedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "reservations": []
}
```

This file is managed automatically but can be edited manually if needed.

## Importing Existing Allocations

If you already have manual port assignments:

1. Copy the example script:

   ```bash
   cp node_modules/devports/scripts/import-example.mjs ./import-ports.mjs
   ```

2. Edit `import-ports.mjs` and add your allocations:

   ```javascript
   const EXISTING_ALLOCATIONS = [
     { port: 5432, project: 'myapp', service: 'postgres', type: 'postgres' },
     { port: 3001, project: 'myapp', service: 'api', type: 'api' },
   ];
   ```

3. Run the import:
   ```bash
   node import-ports.mjs
   ```

## AI Assistant Integration

`devports` is designed to work seamlessly with AI coding assistants (Claude Code, Cursor, GitHub Copilot, etc.). See [AI-ASSISTANT-GUIDE.md](./AI-ASSISTANT-GUIDE.md) for comprehensive automation patterns and examples.

Quick tips for AI usage:

- Use `--quiet` to get just the port number
- Use `--json` for structured output
- All commands return proper exit codes
- No interactive prompts - fully scriptable

## Port Availability Checking

devports automatically checks if ports are actually in use when allocating them:

```bash
# If port 5432 is in use, devports will skip to 5433, 5434, etc.
devports allocate myproject postgres --type postgres
# → ✅ Allocated port 5433 for myproject/postgres
# → ⚠️  Warning: Port 5433 is currently in use by another process.
```

The warning helps you identify potential conflicts, but allocation still succeeds since the process might not be running when you need the port.

## Environment Variables

When devports creates `.env` files (via worktree commands), it includes:

- **Port variables**: `DATABASE_PORT`, `API_PORT`, etc.
- **Project name**: `DEVPORTS_PROJECT_NAME` (URL-safe version of project name)

This is useful for dynamic configuration like Tailscale funnel domains, development URLs, and external tool integration.

## Integration Guides

devports works seamlessly with various development tools and platforms:

- **[Docker & Docker Compose](./DOCKER.md)** - Complete guide for container port management and naming conflicts
- **AI Assistant Integration** - See [AI-ASSISTANT-GUIDE.md](./AI-ASSISTANT-GUIDE.md) for automation patterns
- **Contributing** - See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines

## Tips & Best Practices

### Project Naming

To avoid conflicts between projects with same branch names:

**Good:**

```bash
# Use project-specific identifiers
devports allocate "myproject-feature-auth" postgres --type postgres
devports allocate "otherproject-feature-auth" postgres --type postgres
```

**Also Good:**

```bash
# Include project name in identifier
PROJECT=$(basename $(pwd))
devports allocate "$PROJECT-$BRANCH" postgres --type postgres
```

### Team Collaboration

Share consistent port ranges across the team:

```bash
# Commit a team config template
cp ~/.config/devports/config.json ./devports-config.json
git add devports-config.json

# Team members link it (keeps configs in sync)
ln -sf "$(pwd)/devports-config.json" ~/.config/devports/config.json
```

This symlink approach ensures everyone stays in sync automatically when the config is updated.

### Cleanup

Release ports when completely finished with a project or worktree:

```bash
# Release specific service
devports release myproject postgres

# Release all ports for a project (when completely done)
devports release myproject --all

# Or by port number
devports release 5432 --port
```

"Done" means you're completely finished with the project/worktree, not just done for the day.

## Command Reference

### allocate

```bash
devports allocate <project> <service> --type <type> [options]

Options:
  -t, --type <type>  Service type (postgres, mysql, redis, api, app, custom) [required]
  -q, --quiet        Output only the port number
  --json             Output as JSON
```

### release

```bash
devports release <project> [service] [options]

Options:
  -a, --all     Release all ports for project
  -p, --port    First argument is port number to release
  -q, --quiet   Suppress output
  --json        Output as JSON
```

### list

Shows current port allocations.

```bash
devports list [options]

Options:
  -p, --project <name>  Filter by project
  -t, --type <type>     Filter by type
  -q, --quiet           Output only port numbers
  --json                Output as JSON
```

Example output:

```
📋 Port Allocations:

🏗️  myapp
┌──────┬──────────────────┬──────────────────┬────────────────────────┐
│ Port │ Service          │ Type             │ Allocated              │
├──────┼──────────────────┼──────────────────┼────────────────────────┤
│ 3000 │ api              │ api              │ 11/17/2025, 2:34:18 PM │
│ 5432 │ postgres         │ postgres         │ 11/17/2025, 2:34:18 PM │
└──────┴──────────────────┴──────────────────┴────────────────────────┘

🏗️  feature-auth
┌──────┬──────────────────┬──────────────────┬────────────────────────┐
│ Port │ Service          │ Type             │ Allocated              │
├──────┼──────────────────┼──────────────────┼────────────────────────┤
│ 5433 │ postgres         │ postgres         │ 11/17/2025, 3:15:22 PM │
└──────┴──────────────────┴──────────────────┴────────────────────────┘
```

### status

Shows port availability statistics by type.

```bash
devports status [options]

Options:
  -q, --quiet  Output type:port pairs
  --json       Output as JSON
```

Example output:

```
Port Status:

postgres    : 2 used, 66 available
              Next available: 5434
mysql       : 0 used, 94 available
              Next available: 3306
api         : 1 used, 99 available
              Next available: 3001
```

### check

```bash
devports check <port> [options]

Options:
  -q, --quiet  Silent mode (exit code only: 0=available, 1=in use)
  --json       Output as JSON
```

### worktree

#### add

```bash
devports worktree add <path> [options]

Options:
  -b, --branch <branch>     Create and checkout a new branch [required]
  --no-env                  Skip .env file creation
  --env-file <file>         Custom .env file name (default: .env)
  --services <services>     Services to allocate (comma-separated)
  --template <file>         Use template file for .env generation
  --post-hook <script>      Run script after worktree creation
  --json                    Output as JSON

Template Patterns:
  {devports:project}        → URL-safe project name (recommended)
  {DEVPORTS_PROJECT_NAME}   → URL-safe project name (deprecated, use {devports:project})
  {devports:type:service-name} → Allocated port for service (type required)
```

#### remove

```bash
devports worktree remove <path> [options]

Options:
  -f, --force    Force removal even if worktree is dirty
  --json         Output as JSON
```

### info

```bash
devports info [--json]
```

Shows configuration location, registry location, and port statistics.

### reserve / unreserve

```bash
devports reserve <port> [reason]
devports unreserve <port>
```

Reserve or unreserve a specific port to prevent automatic allocation.

### render

```bash
devports render <file> [options]

Options:
  -p, --project <name>  Project name (overrides template project name)
  -o, --output <file>   Output file (defaults to stdout)
  --json                Output allocation info as JSON
```

Render a template file by replacing `{devports:type:service-name}` patterns with allocated ports.

Example:

```bash
# Render template to stdout
devports render .env.devports

# Render to specific file
devports render config.yml.devports -o config.yml

# Override project name
devports render .env.devports --project myproject-feature
```

### gitignore

```bash
devports gitignore [options]

Options:
  --preview  Show what would be added without making changes
  --clean    Remove stale devports entries from .gitignore
  --json     Output as JSON
```

Manage .gitignore entries for `*.devports` files. For each `file.devports` found, adds `file` to .gitignore to prevent committing generated files while keeping templates in version control.

Examples:

```bash
# Add *.devports files to .gitignore
devports gitignore

# Preview what would be added
devports gitignore --preview

# Clean up stale entries
devports gitignore --clean
```

### completion

```bash
devports completion [shell] [options]

Arguments:
  shell                  Shell type (bash, zsh) - defaults to zsh

Options:
  -i, --install         Install completion script and setup shell config automatically
  -u, --uninstall       Remove completion script and clean shell config
  --check               Check if completion is already installed
  --test                Test if completion works in a fresh shell
  --json                Output as JSON
```

Generate and install shell completion scripts. Supports tab completion for commands, project names, service names, port types, and file paths.

Examples:

```bash
# Install zsh completion (macOS default)
devports completion zsh --install

# Install bash completion (Linux default)
devports completion bash --install

# Generate script to stdout
devports completion zsh

# Check if already installed
devports completion zsh --check
```

## Shell Completion

devports supports tab completion for commands, options, and dynamic values like project names.

### Quick Setup

**One-Command Setup (All Platforms)**:

```bash
# Automatic setup for your shell (detects zsh/bash)
devports completion --install

# Then start a new terminal or reload your shell config
```

The `--install` command automatically:

- ✅ Detects your shell (zsh on macOS, bash on Linux)
- ✅ Installs the completion script
- ✅ Updates your shell config (.zshrc/.bashrc)
- ✅ Adds helpful comments with instructions

### Advanced Options

```bash
# Check if completion is already installed
devports completion --check

# Test that completion works (validates in fresh shell)
devports completion --test

# Generate completion script to stdout
devports completion zsh

# Uninstall completion (removes files and shell config)
devports completion --uninstall
```

### What Gets Completed

- **Commands**: `devports <TAB>` → allocate, release, list, status, etc.
- **Project names**: `devports release -a <TAB>` → cycles through actual project names
- **Service names**: `devports release myproject <TAB>` → shows services for that project
- **Port types**: `devports allocate myproject service --type <TAB>` → postgres, mysql, redis, etc.
- **File paths**: Template files, scripts, output files
- **Options**: All command-line flags and options

### Examples

```bash
# Tab completion in action:
devports rel<TAB>          # → devports release
devports release -a my<TAB> # → cycles through projects starting with "my"
devports allocate myapp db --type post<TAB> # → postgres
```

The completion dynamically reads your current port allocations, so project and service names are always up to date.

## Troubleshooting

**"devports: command not found"**

```bash
npm install -g devports
# Or check: npm list -g devports
```

**"Port already allocated"**

```bash
devports list --project myproject
devports release myproject service
```

**"No available ports"**

```bash
devports status
devports list --type postgres
# Consider expanding range in config
```

**"Invalid service type"**

```bash
devports info  # See valid types
# Valid: postgres, mysql, redis, api, app, custom
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) and [DEVELOPMENT.md](./DEVELOPMENT.md).

Ideas for contributions:

- Docker Compose auto-update integration
- VSCode extension
- Port health checking (verify ports aren't in use)
- Team sync features
- Additional port type presets

## License

MIT © [Ben Dechrai](https://bendechr.ai)

## Links

- [npm package](https://www.npmjs.com/package/devports)
- [GitHub repository](https://github.com/bendechrai/devports)
- [Issue tracker](https://github.com/bendechrai/devports/issues)
- [AI Assistant Guide](./AI-ASSISTANT-GUIDE.md)
- [Development Guide](./DEVELOPMENT.md)
