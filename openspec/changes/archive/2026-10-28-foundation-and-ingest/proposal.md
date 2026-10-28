# Proposal

## Why

The local multi-document RAG pipeline requires a deterministic, idempotent foundation for parsing, chunking, embedding, and storing heterogeneous documents (`.pdf`, `.md`, `.txt`, `.docx`, `.html`/`.htm`, `.json`) across German and English before retrieval, evaluation, or Web UI layers can operate. Delivering Phases 1–3 as the first runnable vertical slice establishes the local Docker infrastructure (PostgreSQL + Qdrant), database schemas, LLM/embedding client, and CLI ingestion pipeline so the corpus in `data/docs/` can be indexed and verified end-to-end.

## What Changes

- Provision local infrastructure via `docker-compose.yml` for **Qdrant** (`qdrant/qdrant:latest` on port `6333`) and **PostgreSQL** (`postgres:16-alpine` on port `5432`) with persistent named volumes.
- Initialize the **Bun** TypeScript project (`package.json`, `tsconfig.json`, `.env.example`, `src/config.ts`, `src/types.ts`) with zero AI-framework dependencies.
- Implement PostgreSQL schema initialization (`src/db/postgres.ts` for `documents`, `chunks`, and `eval_results` tables) and Qdrant collection initialization (`src/db/qdrant.ts` for the `docs` collection with `1024` dimensions and `Cosine` distance).
- Implement the thin LLM and embedding client (`src/llm.ts`) supporting batched `bge-m3` embeddings via Ollama (`POST /api/embed`) and structured JSON generation via `/v1/chat/completions` validated with Zod (`z.toJSONSchema()`).
- Build the multi-format document loader (`src/ingest/doc-loader.ts`) normalizing `.pdf` (`unpdf`), `.docx` (`mammoth`), `.html`/`.htm` (`cheerio`), `.md`, `.txt`, and nested/array `.json` files into `RawSection[]`, while ignoring non-document companion asset folders (such as `*_files/`).
- Build the deterministic paragraph/word-boundary chunker (`src/ingest/chunker.ts`) producing `~800` character chunks with `~120` character overlap and deterministic UUIDv5 `chunk_id` identifiers.
- Implement the idempotent ingestion service and CLI entrypoint (`src/ingest/ingest.ts`, `bun run ingest` and `bun run ingest --force`) with SHA-256 change detection (`Bun.CryptoHasher`), batched embedding calls, and atomic replacement of existing document chunks in PostgreSQL and Qdrant.

## Capabilities

### New Capabilities
- `document-ingestion`: Local infrastructure setup, multi-format document parsing (`.pdf`, `.md`, `.txt`, `.docx`, `.html`/`.htm`, `.json`), deterministic chunking with UUIDv5 IDs, batched `bge-m3` embedding generation, and idempotent SHA-256-guarded persistence into PostgreSQL and Qdrant.

### Modified Capabilities
<!-- None — initial capability creation -->

## Impact

- **New Infrastructure & Config**: `docker-compose.yml`, `.env.example`, `package.json`, `tsconfig.json`.
- **New Source Modules**:
  - `src/config.ts`
  - `src/types.ts`
  - `src/db/postgres.ts`
  - `src/db/qdrant.ts`
  - `src/llm.ts`
  - `src/ingest/doc-loader.ts`
  - `src/ingest/chunker.ts`
  - `src/ingest/ingest.ts`
- **Dependencies**: `zod`, `@qdrant/js-client-rest`, `postgres`, `unpdf`, `mammoth`, `cheerio`, `@types/bun`, `typescript`.
