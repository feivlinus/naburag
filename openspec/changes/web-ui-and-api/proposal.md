# Proposal

## Why

With core ingestion, deterministic retrieval, and golden evaluation established as CLI tools in Phases 1–4, users and evaluators need an interactive interface to query documents, inspect citations, manage document uploads and chunking, and monitor benchmark metrics. Delivering Phase 5 as the final vertical slice provides a unified, native Bun REST API (`src/server.ts`) and a responsive React 19 + Tailwind CSS + shadcn/ui dashboard (`web/`) with zero external AI-framework bloat.

## What Changes

- Implement native `Bun.serve` REST API in `src/server.ts` exposing:
  - Document management: `GET /api/docs` (list indexed documents), `GET /api/docs/:id/chunks` (inspect stored chunks), `POST /api/docs/upload` (multipart upload and immediate ingestion), `POST /api/docs/sync` (sync local `data/docs/` directory), and `DELETE /api/docs/:id` (atomic deletion from filesystem, PostgreSQL, and Qdrant).
  - Retrieval querying: `POST /api/ask` accepting `{ question, source_file? }` and returning `{ answer, abstained, citations, retrieved_chunks, latency_ms }`.
  - Benchmark evaluation: `GET /api/eval` (fetch recent run history) and `POST /api/eval/run` (execute 10-question Golden Set evaluation and return structured results).
  - Static asset serving or dev proxy support for the single-page application.
- Initialize the frontend application under `web/` with React 19, Vite, TypeScript, and Tailwind CSS:
  - Configure Vite development server with proxy forwarding `/api` to the Bun backend (`http://localhost:3000`).
  - Implement accessible shadcn-style UI component primitives (`Tabs`, `Card`, `Badge`, `Button`, `Input`, `Select`, `Table`, `Sheet`, `Progress`, `ScrollArea`, `Alert`).
  - Implement **Tab 1: Ask & Inspect** (`AskTab.tsx`) with question input, document filter dropdown, preset test question pills, grounded answer card, citation badges, and top-5 retrieved chunk inspection cards with cosine similarity score bars.
  - Implement **Tab 2: Documents & Chunks** (`DocsTab.tsx`) with drag-and-drop file upload, manual sync trigger, indexed documents table, document deletion, and slide-over Sheet drawer to inspect chunk breakdowns.
  - Implement **Tab 3: Golden Set Evaluation** (`EvalTab.tsx`) with one-click evaluation trigger, KPI summary cards (Total Score, Retrieval Hit Rate, Abstention Accuracy), and detailed pass/fail table per evaluation question.
- Add developer scripts to root `package.json` to launch backend and frontend workflows.

## Capabilities

### New Capabilities
- `http-api`: Native Bun REST API endpoints providing document ingestion, deletion, chunk inspection, grounded retrieval query execution, and Golden Set evaluation benchmarking.
- `web-dashboard`: Single-page React 19 application with Tailwind CSS and shadcn-style components providing interactive query answering with inline citations, chunk inspection, document upload/sync management, and evaluation reporting.

### Modified Capabilities
<!-- None: existing CLI workflows and database/vector contracts remain backwards-compatible. -->

## Impact

- **New Backend Modules**: `src/server.ts`.
- **New Frontend Application**: `web/` directory including `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, and `src/` (components, views, API client).
- **Updated Files**: `package.json` (adds `server` and `dev` scripts).
- **Runtime Dependencies**: Uses existing Bun runtime, PostgreSQL, Qdrant, and Ollama services without adding heavy client frameworks.
