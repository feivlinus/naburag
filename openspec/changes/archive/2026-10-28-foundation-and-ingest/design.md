# Design

## Context

See `proposal.md` for motivation and scope. This change establishes Slice 1 (`foundation-and-ingest`) of the local RAG system on Bun, PostgreSQL 16, Qdrant, and local Ollama (`bge-m3`), targeting the real multi-format German/English corpus in `data/docs/` (`BGB.pdf`, `DSVGO.pdf`, `EVB_IT_Dienstleistung_Langfassung.docx`, `legal_memo_eu_ai_act_compliance_mandant.md`, `Die_Verwandlung_Kafka.txt`, `secops_tickets-cve_feed.json`, and `BSI_-_IT-Grundschutz.htm`).

## Goals / Non-Goals

**Goals:**
- Provide a single `docker-compose.yml` for Qdrant (`:6333`) and PostgreSQL (`:5432`) with persistent volumes.
- Normalize all 6 document types (`.pdf`, `.md`, `.txt`, `.docx`, `.html`/`.htm`, `.json`) into a uniform `RawSection[]` structure while gracefully handling corpus quirks (`.htm` extension, companion `*_files/` directories, nested JSON record arrays, and large statutory PDFs).
- Produce deterministic ~800-character chunks (~120-character overlap) with RFC-compliant UUIDv5 IDs accepted by both PostgreSQL (`UUID`) and Qdrant point IDs.
- Implement `src/llm.ts` for batched Ollama `bge-m3` embeddings and OpenAI-compatible structured completions (`z.toJSONSchema()`).
- Provide idempotent CLI ingestion (`bun run ingest [--force]`) with SHA-256 file hash comparison and clean replacement of prior document chunks.

**Non-Goals:**
- Top-k retrieval query flow, citation/abstention prompt engineering, and `bun run ask` CLI (deferred to Slice 2: `retrieval-and-eval-cli`).
- Golden Set evaluation runner `bun run eval` (deferred to Slice 2: `retrieval-and-eval-cli`).
- `Bun.serve()` HTTP endpoints and React 19 + shadcn/ui frontend (deferred to Slice 3: `api-and-web-ui`).

## Decisions

### 1. Database Client: `postgres` (`postgres.js`) with Auto-Migration on Startup
- **Choice**: Use `postgres` (`postgres.js`) in `src/db/postgres.ts` with an `initPostgres()` helper executing `CREATE TABLE IF NOT EXISTS` for `documents`, `chunks`, and `eval_results`.
- **Rationale**: Matches `PROJECT_SPEC.md` dependencies and provides ergonomic bulk insert syntax (`await sql\`INSERT INTO chunks \${sql(rows)}\``) for inserting hundreds or thousands of chunks per document in batches.
- **Alternatives considered**: Raw single-row inserts in a loop (too slow for `BGB.pdf` with thousands of chunks).

### 2. Deterministic UUIDv5 Generation via `Bun.CryptoHasher`
- **Choice**: Generate `chunk_id` in `src/ingest/chunker.ts` using `new Bun.CryptoHasher("sha1")` over a fixed namespace UUID and the key `${source_file}:s${section_number}:c${chunk_index}`, setting RFC 4122 version 5 (`0x50`) and variant (`0x80`) bits.
- **Rationale**: Qdrant strictly requires string point IDs to be valid UUIDs, and PostgreSQL stores `chunk_id` as `UUID PRIMARY KEY`. Computing UUIDv5 with `Bun.CryptoHasher("sha1")` is deterministic and requires zero external UUID packages.

### 3. Multi-Format Loader Refinements for Real `data/docs/` Corpus
- **Choice**:
  - **Directory discovery (`src/ingest/ingest.ts`)**: Read only top-level entries in `data/docs/` (non-recursive) filtered to `.pdf`, `.md`, `.txt`, `.docx`, `.html`, `.htm`, `.json`, automatically skipping companion directories like `BSI_-_IT-Grundschutz_files/`.
  - **HTML (`.html` & `.htm`)**: Use `cheerio` to remove `script, style, nav, footer, header, noscript, svg`, then walk headings (`h1`, `h2`, `h3`) and collect following sibling/block text until the next heading.
  - **JSON (`.json`)**: If the parsed root is an array, emit each element as a `RawSection`. If the root is an object (like `secops_tickets-cve_feed.json`), iterate top-level entries: when a value is an array of objects (e.g., `cve_advisories`, `support_tickets`), emit each item as its own `RawSection` with a descriptive heading incorporating any primary identifier (`cve_id`, `ticket_id`, `id`, `name`, or index); when a value is a plain object/primitive (e.g., `dataset_metadata`), emit it as a single `RawSection` with the key as heading.
- **Rationale**: Prevents lumping all SecOps tickets or CVEs into a single oversized section and improves citation granularity.

### 4. Batched Embeddings and Database Upserts
- **Choice**: In `src/llm.ts`, `embedTexts(texts: string[], batchSize = 64)` slices the input array into batches of 64 strings per `POST ${OLLAMA_BASE_URL}/api/embed` call. Similarly, Qdrant `upsert` and Postgres `chunks` inserts execute in batches of 250 records inside `src/ingest/ingest.ts`.
- **Rationale**: Statutory PDFs (`BGB.pdf`, `DSVGO.pdf`) yield thousands of chunks. Batching avoids HTTP payload/timeout errors in Ollama and parameter limit errors (65,534 parameters) in PostgreSQL wire protocol.

## Risks / Trade-offs

- **[Risk] Large PDF parsing and embedding duration (`BGB.pdf`)** → Mitigation: Log per-file section count, chunk count, and batch embedding progress (`batch X/Y`) in `bun run ingest` so the user has clear real-time feedback; SHA-256 hashing ensures subsequent runs skip already-ingested files in milliseconds.
- **[Risk] Partial state if Ollama fails mid-document** → Mitigation: Perform all chunk embedding batches for a document *before* deleting the old document record/points and inserting the new ones into PostgreSQL and Qdrant, so a failed embedding call never wipes out previously indexed data.
