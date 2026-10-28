# Contributing to NabuRAG

Thank you for your interest in contributing to **NabuRAG**!

To ensure project stability, security, and deterministic reproducibility, all contributions must follow this process.

---

## Code of Conduct & Permissions

1. **Direct Pushes Are Disabled**: No contributor (including maintainers) should push directly to the `master` branch.
2. **Pull Requests Only**: All proposed changes, bug fixes, and feature additions must be submitted via Pull Requests from a topic branch or personal fork.
3. **Maintainer Review & Approval**: Every Pull Request requires at least one review and approval by repository maintainers prior to merge.
4. **CI Green Requirement**: Automated test suites and TypeScript type checks must pass before any pull request can be merged.

---

## Development Workflow

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/naburag.git
cd naburag
```

### 2. Branching Convention
Create a descriptive branch for your work:
- `feat/<feature-name>` for new capabilities
- `fix/<issue-name>` for bug fixes
- `docs/<topic>` for documentation changes

```bash
git checkout -b feat/my-enhancement
```

### 3. Local Setup & Testing
Start required local infrastructure and install dependencies:
```bash
# Start PostgreSQL & Qdrant
docker compose up -d

# Install backend dependencies
bun install

# Install web frontend dependencies
bun install --cwd web
```

Run test suite and type checking before opening a PR:
```bash
# Run backend & integration test suite
docker compose exec app bun test

# Run TypeScript checks
docker compose exec app bun x tsc --noEmit

# Verify web frontend build
docker compose exec app bun run --cwd web build
```

---

## Pull Request Checklist

Before submitting a Pull Request:
- [ ] Code follows existing conventions and adds tests for new functionality.
- [ ] No secrets, private credentials, or personal API keys are committed.
- [ ] All tests pass via `bun test`.
- [ ] PR description clearly explains the problem solved and links relevant issues.
