# Repository Agent Guidelines

## Terminal & File Discovery Rules
- **NEVER** use `Get-ChildItem` (or PowerShell aliases `dir`, `ls`, `gci`) to inspect, list, or search files or directories.
- **ALWAYS** use `rg` (ripgrep) for searching and listing files (`rg --files`, `rg --files --hidden`, `rg "<pattern>"`).

## Execution & Container Guidelines
- **ALWAYS** run tests and Bun project commands inside the running Docker Compose `app` container:
  - Tests: `docker compose exec app bun test` (or `docker compose exec app bun test test/<file>.test.ts`)
  - Type checking: `docker compose exec app bun x tsc --noEmit`
  - Ingestion: `docker compose exec app bun run ingest`
- **NEVER** use ad-hoc shell code injection or one-liner eval commands (e.g., `bun -e "..."` or inline script injection) to test or verify functionality.
- **ALWAYS** write proper, clean test files under `test/` or scripts under `src/` and run them via standard commands.

## Git Workflow & Branching Guidelines
- **Primary / Default Branch**: The primary branch is **`master`**. Never use or create `main`.
- **Branching & PR Requirement**: NEVER commit or push directly to `master`. Always create a new topic branch (e.g. `feat/<name>`, `fix/<name>`), push the branch, and merge via Pull Request into `master`.

