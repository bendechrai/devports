# devports Roadmap

This document outlines planned features and ideas for future development.

## High Priority Features

### Working Directory Tracking

- Track the working directory where `devports allocate` was called
- Detect if project directories no longer exist
- `devports cleanup` command to suggest releasing orphaned ports
- Handle edge case where allocation happens before project is cloned

### Enhanced Port Detection

- Integrate with system tools (`lsof`, `netstat`) for better port conflict detection
- Warning system for ports that appear to be in use by other processes
- Auto-discovery of running services on allocated ports

### Improved Error Messages

- Context-aware suggestions when allocation fails
- Better error messages with next steps
- Validation warnings for common misconfigurations

## Medium Priority Features

### Developer Experience

- Shell completion for bash/zsh/fish
- VSCode extension for visual port management
- Better CLI help with examples and tips

### Bulk Operations

- Allocate multiple ports at once: `devports allocate myapp postgres,redis,api`
- Port range allocation: get N consecutive ports
- Batch import/export for team onboarding

### Advanced Port Management

- Port groups or profiles for common setups
- Reserved port ranges for specific teams/purposes
- Port expiration and automatic cleanup after inactivity

## Low Priority / Ideas

### Team & Collaboration

- Shared registries via git or cloud storage
- Team dashboards showing current allocations
- Webhook notifications for port events

### Integrations

- Docker Compose port forwarding helper
- Kubernetes port-forward automation
- Integration with popular development tools

### Advanced Features

- Port health monitoring (ping allocated services)
- Analytics on port usage patterns
- Migration tools from other port management systems

## Breaking Changes (Future Major Version)

### CLI Improvements

- Consider renaming commands for clarity:
  - `devports allocations` instead of `devports list`
  - `devports availability` instead of `devports status`
- Standardize output formats across all commands
- Remove deprecated features or confusing defaults

### Configuration Evolution

- Simplified config file format
- Migration utilities for old configs
- Better validation and error reporting

## Implementation Notes

### Working Directory Tracking

```typescript
interface PortAllocation {
  port: number;
  project: string;
  service: string;
  type: string;
  allocatedAt: string;
  workingDir?: string; // New field
}
```

The cleanup command would:

1. Check if `workingDir` still exists
2. Look for common project files (package.json, .git, etc.)
3. Suggest releasing ports for missing/inactive projects
4. Provide safe "dry-run" mode before actual cleanup

### Port Health Checking

- Periodic background checking of allocated ports
- Integration with system monitoring tools
- Status indicators in `devports list` output

## Community Ideas

We welcome community input on these features. If you're interested in implementing any of these ideas:

1. Open an issue to discuss the approach
2. Check if someone else is already working on it
3. Start with a small prototype or RFC
4. Follow the contribution guidelines in CONTRIBUTING.md

## Research Areas

- Integration with container orchestration platforms
- Cross-platform compatibility improvements
- Performance optimization for large port registries
- Security considerations for team-shared configurations

---

Have an idea not listed here? [Open an issue](https://github.com/bendechrai/devports/issues) or start a [discussion](https://github.com/bendechrai/devports/discussions)!
