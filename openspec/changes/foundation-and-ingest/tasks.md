# Tasks

## 1. Local Infrastructure & Bun Project Scaffolding

- [ ] 1.1 Create `docker-compose.yml` defining `qdrant` (`qdrant/qdrant:latest`, port `6333`, volume `qdrant_data:/qdrant/storage`) and `postgres` (`postgres:16-alpine`, port `5432`, user `rag`, password `ragpassword`, db `ragdb`, volume `pg_data:/var/lib/postgresql/data`) and verify `docker compose config` validates cleanly.
- [ ] 1.2 Create root `package.json` (with scripts `infra:up`, `infra:down`, `ingest`, `test` and dependencies `zod`, `@qdrant/js-client-rest`, `postgres`, `unpdf`, `mammoth`, `cheerio`, plus devDependencies `@types/bun`, `typescript`), `tsconfig.json`, and `.env.example`, then run `bun install` and verify all packages install without error.
- [ ] 1.3 Create `src/config.ts` (Zod-validated environment configuration for Postgres, Qdrant, Ollama embedding model `bge-m3`, and LLM endpoint) and `src/types.ts` (`RawSection`, `ChunkPayload`, `RagAnswer`, `EvalCase`), and verify `bun x tsc --noEmit` passes.

## 2. Database & Vector Store Initialization

- [ ] 2.1 Implement `src/db/postgres.ts` using `postgres` (`postgres.js`) with `initPostgres()` to create the `documents`, `chunks` (`ON DELETE CASCADE`), and `eval_results` tables idempotently, and verify schema creation against the running PostgreSQL container.
- [ ] 2.2 Implement `src/db/qdrant.ts` using `@qdrant/js-client-rest` with `initQdrant()` to ensure the `docs` collection exists (`size: 1024`, `distance: "Cosine"`) and `source_file` payload indexing is ready, and verify collection initialization against the running Qdrant container.

## 3. Multi-Format Document Loader & Deterministic Chunker

- [ ] 3.1 Implement `src/ingest/doc-loader.ts` supporting `.pdf` (`unpdf` per-page extraction), `.md` (heading split), `.txt` (~3000-char paragraph-safe sections), `.docx` (`mammoth` raw text sections), `.html`/`.htm` (`cheerio` stripping `script`/`style`/`nav`/`footer` and splitting on `h1`–`h3`), and `.json` (top-level array items and nested record arrays with identifier headings), and verify unit tests pass against the real files in `data/docs/`.
- [ ] 3.2 Implement `src/ingest/chunker.ts` to split `RawSection[]` into ~800-character chunks with ~120-character overlap on paragraph/word boundaries and deterministic RFC 4122 UUIDv5 `chunk_id` values (`${source_file}:s${section_number}:c${chunk_index}` via `Bun.CryptoHasher("sha1")`), and verify unit tests confirm deterministic UUIDs, word-boundary safety, and overlap behavior.

## 4. Batched Embedding Client & Idempotent Ingestion Pipeline

- [ ] 4.1 Implement `src/llm.ts` with batched `embedTexts(texts, batchSize)` calling Ollama `POST /api/embed` (`bge-m3`, 1024 dims) and `generateStructured<T>()` calling `/v1/chat/completions` with `z.toJSONSchema()`, and verify `embedTexts` returns 1024-dimensional vectors.
- [ ] 4.2 Implement `src/ingest/ingest.ts` with top-level `data/docs/` discovery (ignoring `*_files/` asset folders), SHA-256 hash comparison (`Bun.CryptoHasher("sha256")`), `--force` flag support, batched embeddings, and atomic replacement of Qdrant points and PostgreSQL `documents`/`chunks` records, and verify `bun run ingest` indexes the `data/docs/` corpus and skips unchanged files on a second run.
