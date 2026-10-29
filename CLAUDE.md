@AGENTS.md

# Claude Code Notes

The rules in `AGENTS.md` (imported above) are shared with all coding agents and take precedence.

## Project at a glance
- NabuRAG: local RAG system. Bun backend (`src/`), React 19 + Vite + shadcn/ui frontend (`web/`), Qdrant + PostgreSQL 16 + Ollama via Docker Compose.
- No AI frameworks (no LangChain/LlamaIndex/Vercel AI SDK). LLM/embedding calls go through `src/llm.ts` with native `fetch` + Zod schemas. Keep it that way.
- Product spec: `docs/PROJECT_SPEC.md`. Decision log: `docs/DECISIONS.md` (newest first).

## Commands (run inside the `app` container)
- Start infra: `docker compose up -d` (Ollama profile via `COMPOSE_PROFILES` in `.env`: `nvidia` | `rocm` | `cpu`)
- Tests: `docker compose exec app bun test`
- Type check: `docker compose exec app bun x tsc --noEmit`
- Web build: `docker compose exec app bun run --cwd web build`
- Ingest / ask / eval: `docker compose exec app bun run ingest|ask|eval`

## Spec-driven workflow (OpenSpec)
- Feature work goes through OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive` (also `/opsx:explore`, `/opsx:update`, `/opsx:sync`).
- Current specs live in `openspec/specs/`, completed changes in `openspec/changes/archive/`.
- The `.claude/`, `.gemini/` and `.agents/` OpenSpec files are generated. Regenerate with `openspec update` instead of editing them by hand.
