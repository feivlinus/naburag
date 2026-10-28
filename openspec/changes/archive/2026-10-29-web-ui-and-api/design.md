# Design

## Context

The core RAG pipeline consists of modular services for document parsing (`src/ingest/doc-loader.ts`), chunking (`src/ingest/chunker.ts`), idempotent indexing (`src/ingest/ingest.ts`), similarity search and structured generation (`src/retrieval/retrieve.ts`), and benchmarking (`eval/run-eval.ts`). All data is persisted in PostgreSQL (tables `documents`, `chunks`, `eval_results`) and Qdrant (collection `docs`).

Phase 5 builds on these established modules to provide an HTTP server and a responsive web dashboard without modifying core database schemas or existing CLI tool behavior. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a lightweight, zero-dependency REST HTTP API in `src/server.ts` using `Bun.serve`.
- Enable document upload (`data/docs/`), synchronization, chunk inspection, and atomic deletion across filesystem, PostgreSQL, and Qdrant.
- Expose question answering (`/api/ask`) with grounded responses, citation metadata, and retrieved chunk payloads with similarity scores.
- Expose Golden Set evaluation execution (`/api/eval/run`) and recent run retrieval (`/api/eval`).
- Build an accessible, clean React 19 SPA in `web/` with Vite, TypeScript, Tailwind CSS, and shadcn/ui-styled components.
- Support both local Vite development proxy (`http://localhost:5173` -> `http://localhost:3000`) and production static hosting from `web/dist`.

**Non-Goals:**
- User authentication, role-based access control, or multi-tenant database isolation.
- Replacing existing Bun CLI commands (`bun run ingest`, `bun run ask`, `bun run eval`).
- WebSocket or token-by-token streaming generation (the architecture preserves structured Zod validation via `generateStructured`).
- External cloud storage integration (local directory `data/docs/` remains source of truth).

## Decisions

### 1. Bun Native HTTP Server (`src/server.ts`)
- **Decision**: Implement REST routes using `Bun.serve({ port, fetch })` with URL pathname dispatching and helper response utilities.
- **Rationale**: Bun's native server provides microsecond-level overhead, zero additional npm packages (no Express/Hono needed), and direct interoperability with `Bun.file()` and `req.formData()`.
- **Alternatives Considered**: Fastify/Express (adds unwanted node runtime layers and dependencies) or Hono (unnecessary extra dependency for eight REST routes).

### 2. Multi-Format Upload and Immediate Ingestion
- **Decision**: `POST /api/docs/upload` extracts files via `await req.formData()`, writes to `data/docs/<filename>` using `Bun.write()`, and invokes a single-file ingestion helper that parses, chunks, embeds, and updates PostgreSQL and Qdrant.
- **Rationale**: Writing immediately to `data/docs/` preserves the filesystem as the ground truth corpus directory, allowing CLI `bun run ingest` and UI uploads to stay in sync.
- **Alternatives Considered**: In-memory parsing without saving to disk (breaks reproducibility and sync between disk and database).

### 3. Atomic Document Deletion
- **Decision**: `DELETE /api/docs/:id` identifies the document's `source_file`, unlinks `data/docs/<source_file>` if present, deletes vector points matching `{ key: "source_file", match: { value: source_file } }` in Qdrant, and deletes the row in PostgreSQL (which cascades to `chunks`).
- **Rationale**: Keeps PostgreSQL, Qdrant vectors, and the filesystem in complete parity.
- **Alternatives Considered**: Soft-deletion (leaves orphan vectors in Qdrant, skewing cosine search results).

### 4. Golden Set Evaluation API Integration
- **Decision**: `POST /api/eval/run` executes `runGoldenEvaluation({ persist: true })` in-process, returning the computed summary and test case list. `GET /api/eval` queries recent runs from `eval_results` grouped by `run_id`.
- **Rationale**: Reuses the validated evaluation engine directly without shelling out or duplicating scoring logic.
- **Alternatives Considered**: Running `bun run eval` as a child process (adds process spawn overhead, stdout parsing fragility).

### 5. Frontend Architecture & shadcn/ui Design Tokens
- **Decision**: Scaffold `web/` with Vite (`react-ts`), Tailwind CSS, and Lucide icons. Implement modular shadcn/ui primitives (`Tabs`, `Card`, `Badge`, `Button`, `Input`, `Select`, `Table`, `Sheet`, `Progress`, `ScrollArea`, `Alert`) with a lightweight `cn()` helper (`clsx` + `tailwind-merge`).
- **Rationale**: Gives full visual fidelity to shadcn/ui without requiring interactive CLI tooling in CI/containers, keeping builds fast, predictable, and fully inspectable.
- **Alternatives Considered**: Monolithic UI libraries like Material UI or Ant Design (large bundle sizes, opinionated CSS overrides).

## Risks / Trade-offs

- **[Risk: Long evaluation response times]** Running 10 LLM questions sequentially can take 15–40 seconds depending on host GPU/CPU.
  → *Mitigation*: The frontend button displays a loading spinner and disables concurrent runs while `/api/eval/run` is executing.
- **[Risk: Development CORS conflicts]** Vite runs on port 5173 while Bun server runs on port 3000.
  → *Mitigation*: `src/server.ts` includes CORS headers (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`) and `OPTIONS` preflight handling, while `web/vite.config.ts` also sets up `/api` reverse proxying.
- **[Risk: Concurrent file uploads or syncs]** Multiple simultaneous ingestion jobs could race on PostgreSQL or Qdrant points.
  → *Mitigation*: Single-file upload and sync operations use transactional replacement per `source_file` in PostgreSQL and point filter deletion in Qdrant.
