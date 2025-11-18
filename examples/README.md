# Examples Directory

This directory contains example scripts showing how to use devports in various scenarios.

## Running Examples

All example scripts are designed to be safe and clean up after themselves.

### Basic Usage

```bash
./examples/basic.sh
```

Shows basic allocation, listing, and release operations.

### Git Worktree Integration

```bash
./examples/worktree.sh feature/my-feature
```

Demonstrates creating a git worktree with automatic port allocation.

### Programmatic Usage (Node.js)

```bash
# After installing devports
node examples/programmatic.mjs
```

Shows how to use devports Node.js API programmatically.

### JSON Parsing

```bash
./examples/json-parsing.sh
```

Demonstrates using `--json` output with `jq` for parsing.

## Example Scripts

| Script             | Description                       | Requirements |
| ------------------ | --------------------------------- | ------------ |
| `basic.sh`         | Basic CLI usage                   | bash         |
| `worktree.sh`      | Git worktree with port allocation | bash, git    |
| `programmatic.mjs` | Node.js API usage                 | node >= 18   |
| `json-parsing.sh`  | JSON output parsing               | bash, jq     |

## Make Scripts Executable

```bash
chmod +x examples/*.sh examples/*.mjs
```

## Creating Your Own

Copy any example and modify it for your use case:

```bash
cp examples/basic.sh my-script.sh
# Edit my-script.sh
./my-script.sh
```

## Tips

- All scripts use `--quiet` mode for scripting
- Use `--json` when you need to parse output
- Always clean up allocations when done
- Use unique project names to avoid conflicts

## Real-World Integration

For integrating devports into your actual projects, see:

- `scripts/create-worktree-with-devports.sh` - Full worktree setup
- [AI-ASSISTANT-GUIDE.md](../AI-ASSISTANT-GUIDE.md) - Automation patterns
- [README.md](../README.md) - Integration examples
