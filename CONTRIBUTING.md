# Contributing to Chrysalis

Thank you for your interest in contributing to Chrysalis!

## Development Setup

```bash
# Clone repository
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Project Structure

- `src/` - Source code
- `docs/` - Documentation
- `examples/` - Usage examples
- `tests/` - Test suite
- `mcp-servers/` - MCP server implementations

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Update documentation
5. Run `npm run build` to verify
6. Commit with clear messages
7. Push and create Pull Request

## Documentation Standards

See [semantic-doc-prompt.md](semantic-doc-prompt.md) for documentation guidelines.

**Required for all docs**:
- Header with version and status
- Purpose statement
- Mermaid diagrams where appropriate
- Citations for research
- Navigation links

## Code Standards

- TypeScript strict mode
- JSDoc comments for public APIs
- Single responsibility principle
- Pattern-based architecture
- Evidence-based design decisions

## Commit Message Format

```
type(scope): brief description

Detailed explanation of changes.

- Bullet points for key changes
- Reference issues: Fixes #123
```

**Types**: feat, fix, docs, refactor, test, chore

## Pull Request Process

1. Update documentation
2. Add tests
3. Ensure build succeeds
4. Request review
5. Address feedback
6. Merge when approved

## Questions?

Open an issue or discussion on GitHub.

---

**Thank you for contributing to Chrysalis!** 🦋
