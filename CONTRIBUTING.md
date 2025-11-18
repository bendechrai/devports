# Contributing to devports

Thanks for your interest in contributing! This tool solves a real problem for developers working with multiple projects.

## Quick Start

### Development Setup

```bash
# Clone and setup
git clone https://github.com/bendechrai/devports.git
cd devports
npm install

# Build and link for local testing
npm run build
npm link

# Verify installation
devports --version

# Run tests
npm test
```

### Development Workflow

```bash
# Watch mode for development
npm run dev

# Run tests (watch mode available with npm run test:watch)
npm test

# Type checking
npm run lint

# Build for distribution
npm run build
```

## Project Architecture

### Structure

```
devports/
├── src/
│   ├── types.ts          # TypeScript interfaces and type guards
│   ├── config.ts         # Configuration and registry management
│   ├── port-manager.ts   # Core port allocation logic
│   ├── port-utils.ts     # Port availability checking
│   ├── worktree.ts       # Git worktree integration
│   ├── cli.ts            # Command-line interface
│   └── index.ts          # Public API exports
├── test/                 # Test suite (Vitest)
├── .github/workflows/    # CI/CD automation
└── docs/                 # Documentation
```

### Core Concepts

1. **Configuration** (`~/.config/devports/config.json`): Defines port ranges for service types
2. **Registry** (`~/.config/devports/ports.json`): Tracks all allocations and reservations
3. **File Locking**: Uses `proper-lockfile` to prevent race conditions
4. **Type System**: Each port belongs to a type (postgres, mysql, api, etc.) with its own range
5. **Port Checking**: Validates actual port availability using network connections

### Port Allocation Flow

```
User: devports allocate myproject postgres --type postgres
  ↓
1. Validate type exists in config
2. Lock registry file
3. Load current allocations
4. Check if project/service already allocated → error if yes
5. Find next available port in type's range (checking actual usage)
6. Create allocation record
7. Save registry
8. Unlock file
9. Return port number (with warning if port is in use)
```

## Making Changes

### Feature Development Process

1. **Fork and branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Implement changes**
   - Update types in `src/types.ts` if needed
   - Add logic to appropriate file(s)
   - Update CLI in `src/cli.ts` if adding commands
   - Export from `src/index.ts` if part of public API

3. **Add tests**
   - Write tests in `test/` directory
   - Test both success and failure cases
   - Use descriptive test names
   - Clean up after tests (use temp directories)

4. **Update documentation**
   - README.md for user-facing changes
   - Command reference with examples
   - ROADMAP.md for future ideas

5. **Validate changes**

   ```bash
   npm test        # All tests pass
   npm run build   # TypeScript compiles
   npm run lint    # Type checking passes
   devports --help # CLI works correctly
   ```

6. **Commit and create PR**
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push origin feature/my-feature
   ```

### Code Style Guidelines

- **TypeScript strict mode** - all types explicit, no `any`
- **ESM modules** - use import/export, not require
- **Async/await** - for asynchronous operations
- **Small functions** - single responsibility principle
- **Error handling** - provide helpful, actionable error messages
- **JSDoc comments** - for all public APIs
- **No comments in implementation** unless absolutely necessary

### Testing Best Practices

We use Vitest for testing. Good tests should:

- Use isolated temp directories for file operations
- Mock external dependencies (git commands, network calls)
- Test error conditions, not just happy paths
- Have descriptive names that explain what is being tested

Example:

```typescript
it('should allocate different port types in correct ranges', async () => {
  const pgPort = await allocatePort('test', 'postgres', 'postgres');
  const apiPort = await allocatePort('test', 'api', 'api');

  expect(pgPort).toBeGreaterThanOrEqual(5432);
  expect(pgPort).toBeLessThanOrEqual(5499);
  expect(apiPort).toBeGreaterThanOrEqual(3000);
  expect(apiPort).toBeLessThanOrEqual(3099);
});
```

## Common Development Tasks

### Adding a New Port Type

1. **Update default config** in `src/config.ts`:

   ```typescript
   const DEFAULT_CONFIG: Config = {
     ranges: {
       // ... existing
       newtype: { start: 7000, end: 7099 },
     },
   };
   ```

2. **Update valid types** in `src/types.ts`:

   ```typescript
   export const VALID_PORT_TYPES = [
     // ... existing
     'newtype',
   ] as const;
   ```

3. **Add documentation** and examples

### Adding a New CLI Command

1. **Add command** in `src/cli.ts`:

   ```typescript
   program
     .command('mycommand')
     .description('My new command')
     .option('--my-option', 'Option description')
     .action(async (options) => {
       // Implementation
     });
   ```

2. **Implement logic** in appropriate file
3. **Add tests** and **update documentation**

### Debugging

```bash
# Check registry contents
cat ~/.config/devports/ports.json | jq '.'

# Check config
cat ~/.config/devports/config.json | jq '.'

# Test with verbose output
DEBUG=devports devports allocate test postgres --type postgres
```

## Pull Request Guidelines

### Before Submitting

- [ ] **Tests pass**: `npm test`
- [ ] **Build succeeds**: `npm run build`
- [ ] **Types check**: `npm run lint`
- [ ] **Documentation updated** (README, command reference)
- [ ] **Breaking changes noted** in PR description
- [ ] **Manual testing** completed with linked binary

### PR Description Template

```markdown
## Description

Brief description of what this PR does

## Changes

- Change 1
- Change 2

## Testing

How you tested this change

## Documentation

- [ ] README.md updated
- [ ] Command reference updated (if needed)
- [ ] Examples added (if needed)

## Breaking Changes

List any breaking changes, or write "None"
```

## Release Process

Releases are automated via semantic-release. The process:

1. **Commit using conventional commits** (feat:, fix:, chore:, etc.)
2. **Push to main branch**
3. **GitHub Actions runs**:
   - Tests on multiple Node versions
   - Builds TypeScript
   - Runs semantic-release
   - Publishes to npm with provenance
   - Creates GitHub release with auto-generated notes

For maintainers making manual releases:

```bash
# Update CHANGELOG.md if needed
npm version [patch|minor|major]
git push origin main --tags
```

## Ideas and Feature Requests

We have a [ROADMAP.md](./ROADMAP.md) with planned features. Before implementing:

1. **Check existing issues** and discussions
2. **Open an issue** to discuss approach
3. **Start small** with a prototype or proof of concept
4. **Follow contribution guidelines**

High priority areas for contribution:

- Working directory tracking for port cleanup
- Shell completion for better developer experience
- Enhanced port conflict detection
- VSCode extension for visual management

## Testing Your Changes

### Local Testing

```bash
# Build and link
npm run build
npm link

# Test CLI commands
devports allocate test postgres --type postgres
devports list
devports release test --all

# Test in real project
cd ../my-project
PORT=$(devports allocate myproject db --type postgres --quiet)
echo "Allocated port: $PORT"
```

### Package Testing

```bash
# Create and test package
npm pack
cd /tmp
npm install -g /path/to/devports-0.1.0.tgz
devports --version
```

## Getting Help

- **Issues**: Bug reports and feature requests
- **Discussions**: Questions, ideas, and general chat
- **Twitter**: [@bendechrai](https://twitter.com/bendechrai)

## Code of Conduct

Be respectful and constructive. We're all here to make development easier.

## Recognition

Contributors are recognized in:

- README.md contributors section
- GitHub contributors page
- Release notes
- Special thanks in major releases

Thank you for making devports better! 🚀
