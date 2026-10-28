Here is the final, locked-in **`AGENTS.md` / `PROJECT_SPEC.md`** tailored specifically for **Bun** (`Bun.serve`, `Bun.sql`, native TypeScript execution), **React 19 + Vite + Tailwind CSS + shadcn/ui**, **Qdrant + PostgreSQL in Docker**, and **`bge-m3`** (with zero LangChain or Vercel SDK bloat).

```markdown
# Project Specification: Local Multi-Document RAG Pipeline (Bun + React + shadcn/ui + Qdrant + Postgres)

## 1. Goal & Overview
Build a local, deterministic Retrieval-Augmented Generation (RAG) system running on **Bun** with a **React + shadcn/ui** dashboard, backed by **Docker Desktop** (**Qdrant** for vector search and **PostgreSQL** for document/chunk/evaluation tracking) with **zero AI-framework bloat** (no LangChain, no Vercel SDK).

The system must:
1. Ingest and chunk **multiple document formats** (`.pdf`, `.md`, `.txt`, `.docx`, `.html`, `.json` — in English, German, or other languages) via CLI or **shadcn/ui drag-and-drop upload**, preserving page/section metadata.
2. Store document/chunk records in **PostgreSQL** and vector embeddings (`bge-m3`, 1024 dims) in **Qdrant** idempotently (re-ingesting replaces existing chunks without duplicates; unchanged files are skipped via SHA-256 hash).
3. Provide a **React + shadcn/ui Web UI** and Bun CLI to query documents, displaying the grounded answer, inline citation badges (`source_file` + `Page/Section`), and the exact retrieved chunks with similarity scores.
4. Explicitly **abstain** when asked an unanswerable/out-of-scope question.
5. Pass a **10-question Golden Set** evaluation suite (8 answerable across documents + 2 unanswerable), runnable from both the Bun CLI and the Web UI.

---

## 2. Tech Stack & Local Infrastructure

- **Runtime & Backend Server:** **Bun** (`Bun.serve()` for REST API & static file serving, `Bun.sql` / `postgres` for PostgreSQL, `Bun.CryptoHasher` for SHA-256 file hashing)
- **Frontend Web UI:** **React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui** (`lucide-react` icons, `Tabs`, `Card`, `Badge`, `Table`, `Dialog`/`Sheet`, `Progress`, `ScrollArea`)
- **LLM & Embedding Client:** Native `fetch` calling local **Ollama** (`http://localhost:11434`) or **OpenRouter/OpenAI** (`/v1/chat/completions`) + **`zod`** (`z.toJSONSchema()`) for guaranteed structured JSON outputs
- **Embedding Model:** **`bge-m3`** via local Ollama (`1024` dimensions, `Cosine` distance — chosen over `nomic-embed-text` for superior multilingual/German + English retrieval accuracy)
- **Vector Store Client:** Official **`@qdrant/js-client-rest`**
- **Vector Store (Docker):** `qdrant/qdrant:latest` (Port `6333`)
- **Relational DB (Docker):** `postgres:16-alpine` (Port `5432`)
- **Document Parsers:**
  - `.pdf`: **`unpdf`** (per-page text extraction `string[]`)
  - `.docx`: **`mammoth`**
  - `.html`: **`cheerio`**
  - `.md`, `.txt`, `.json`: Native `Bun.file()`

---

## 3. Repository Structure

```text
local-rag/
├── data/
│   └── docs/                  # Uploaded or dropped .pdf, .md, .txt, .docx, .html, .json files
├── eval/
│   ├── golden.json            # 10 QA pairs (8 answerable across docs + 2 unanswerable)
│   └── run-eval.ts            # Evaluation runner (`bun run eval` & POST /api/eval/run)
├── src/
│   ├── config.ts              # Env validation (zod, Bun.env)
│   ├── llm.ts                 # Thin wrapper (~50 lines) for embeddings & structured chat via fetch + Zod
│   ├── server.ts              # Bun.serve() HTTP API (/api/docs, /api/ask, /api/eval)
│   ├── db/
│   │   ├── postgres.ts        # Bun SQL / postgres.js client & schema init (documents, chunks, eval_results)
│   │   └── qdrant.ts          # Official @qdrant/js-client-rest setup & collection init
│   ├── ingest/
│   │   ├── doc-loader.ts      # Multi-format dispatcher (.pdf, .md, .txt, .docx, .html, .json -> RawSection[])
│   │   ├── chunker.ts         # ~800 char chunks, ~120 char overlap, word-boundary safe
│   │   └── ingest.ts          # Ingest service + CLI entry (`bun run ingest`)
│   ├── retrieval/
│   │   ├── retrieve.ts        # Direct Qdrant top-k search + structured LLM generation
│   │   └── ask.ts             # CLI entry (`bun run ask "question"`)
│   └── types.ts               # Shared interfaces (RawSection, ChunkPayload, RagResponse, EvalCase)
├── web/                       # Frontend SPA (React + Vite + Tailwind + shadcn/ui)
│   ├── index.html
│   ├── components.json        # shadcn/ui configuration
│   ├── package.json
│   ├── vite.config.ts         # Proxies /api to http://localhost:3000 in dev
│   └── src/
│       ├── App.tsx            # Main layout with shadcn <Tabs> (Ask, Documents, Evaluation)
│       ├── api.ts             # Typed fetch helpers for /api/*
│       ├── components/
│       │   ├── ui/            # shadcn/ui primitives (button, card, badge, tabs, table, sheet, input, select, progress)
│       │   ├── AskTab.tsx     # Question input, doc filter, grounded answer + citations, retrieved top-k chunk cards
│       │   ├── DocsTab.tsx    # Drag & drop upload, ingested documents table, <Sheet> drawer to inspect chunks
│       │   └── EvalTab.tsx    # "Run Golden Set (10 Qs)" button, score cards, detailed pass/fail <Table>
│       └── lib/
│           └── utils.ts       # cn() helper (clsx + tailwind-merge)
├── docker-compose.yml         # Qdrant + Postgres with persistent named volumes
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 4. Implementation Milestones

### Phase 1: Docker & Bun Project Scaffolding
1. Create `docker-compose.yml` with two services:
   - `qdrant`: image `qdrant/qdrant:latest`, ports `6333:6333`, volume `qdrant_data:/qdrant/storage`.
   - `postgres`: image `postgres:16-alpine`, ports `5432:5432`, env `POSTGRES_USER=rag`, `POSTGRES_PASSWORD=ragpassword`, `POSTGRES_DB=ragdb`, volume `pg_data:/var/lib/postgresql/data`.
2. Initialize root `package.json` for Bun:
   - Dependencies: `zod`, `@qdrant/js-client-rest`, `postgres`, `unpdf`, `mammoth`, `cheerio`
   - Dev: `@types/bun`, `typescript`
3. Create `src/db/postgres.ts` to auto-initialize tables:
   - `documents (id SERIAL PRIMARY KEY, source_file TEXT UNIQUE, file_type TEXT, file_hash TEXT, section_count INT, chunk_count INT, ingested_at TIMESTAMPTZ)`
   - `chunks (chunk_id UUID PRIMARY KEY, document_id INT REFERENCES documents(id) ON DELETE CASCADE, section_number INT, heading TEXT, content TEXT)`
   - `eval_results (id SERIAL PRIMARY KEY, run_id UUID, run_at TIMESTAMPTZ, question TEXT, passed BOOLEAN, abstained BOOLEAN, retrieval_hit BOOLEAN, cited_sources JSONB, answer TEXT)`

### Phase 2: Multi-Format Document Loader & Chunker (`src/ingest/`)
1. **Unified Section Interface (`src/types.ts`):**
   Every file format is normalized into `RawSection[]` before chunking:
   ```ts
   export interface RawSection {
     source_file: string;    // e.g., "patterns.pdf" or "architecture.md"
     section_number: number; // 1-based page number (PDF) or section index (MD/DOCX/TXT/HTML/JSON)
     heading: string;        // e.g., "Page 14" (PDF), "## Auth Flow" (MD/HTML), or "Section 3" (DOCX/TXT)
     text: string;
   }
   ```
2. **Multi-Format Dispatcher (`src/ingest/doc-loader.ts`):**
   - **`.pdf`**: Read bytes via `await Bun.file(path).bytes()` and pass to `extractText(uint8Array, { mergePages: false })` from `unpdf`. Each page becomes a `RawSection` (`section_number = pageIndex + 1`, `heading = "Page ${pageIndex + 1}"`).
   - **`.md`**: Read via `await Bun.file(path).text()`, split on Markdown headings (`^(#{1,3}\s+.+)$`). Each heading block becomes a `RawSection` with `heading = "<Header Text>"`.
   - **`.txt`**: Split into logical sections or ~3000-char blocks with `heading = "Section ${i + 1}"`.
   - **`.docx`**: Use `mammoth.extractRawText({ path })` and split into sections with `heading = "Section ${i + 1}"`.
   - **`.html`**: Use `cheerio` to strip `<script>`, `<style>`, `<nav>`, `<footer>`, then split by `<h1>`/`<h2>`/`<h3>` tags.
   - **`.json`**: Parse via `await Bun.file(path).json()`; each top-level key or array item becomes a `RawSection` with `heading = "Record ${i + 1}"`.
3. **Deterministic Chunking (`src/ingest/chunker.ts`):**
   - For each `RawSection`, split by paragraphs (`\n\n`) and pack into **~800 character chunks** with **~120 characters of overlap**, never cutting mid-word.
   - Produce `ChunkPayload` objects:
     ```ts
     export interface ChunkPayload {
       chunk_id: string;       // Deterministic UUIDv5 from `${source_file}:s${section_number}:c${chunk_index}`
       source_file: string;
       heading: string;        // e.g., "Page 242" or "## Command Pattern"
       section_number: number; // e.g., 242
       content: string;
     }
     ```

### Phase 3: Thin LLM/Embedding Client (`src/llm.ts`) & Idempotent Ingestion (`src/ingest/ingest.ts`)
1. **Direct Embedding & LLM Client (`src/llm.ts`):**
   - `embedTexts(texts: string[]): Promise<number[][]>` calling Ollama's `POST ${OLLAMA_BASE_URL}/api/embed` with `{ model: "bge-m3", input: texts }`.
   - `generateStructured<T>(systemPrompt: string, userPrompt: string, schema: z.ZodType<T>): Promise<T>` calling `${LLM_BASE_URL}/v1/chat/completions` using `response_format: { type: "json_schema", json_schema: { name: "rag_response", strict: true, schema: z.toJSONSchema(schema) } }`, validated with `schema.parse()`.
2. **Qdrant Setup & Idempotent Upsert (`src/ingest/ingest.ts`):**
   - Ensure Qdrant collection `docs` exists with `{ size: 1024, distance: 'Cosine' }` (matching `bge-m3`).
   - Compute SHA-256 `file_hash` using `new Bun.CryptoHasher("sha256")`. If unchanged (and `force !== true`), skip re-embedding.
   - Before inserting chunks for `source_file`:
     1. Delete existing points for `source_file` in Qdrant (`filter: { must: [{ key: 'source_file', match: { value: source_file } }] }`).
     2. Delete existing document record in Postgres (`ON DELETE CASCADE` removes old chunks).
     3. Batch-embed chunks via `embedTexts()` and insert into both Qdrant and Postgres.

### Phase 4: Deterministic Retrieval Pipeline (`src/retrieval/retrieve.ts`)
1. **Step 1:** Embed the user question with `embedTexts([question])`.
2. **Step 2:** Query Qdrant via `qdrant.search('docs', { vector, limit: 5, with_payload: true })` (with optional `source_file` filter).
3. **Step 3:** Format the top-5 chunks as numbered context blocks:
   `[1] Source: <source_file> (<heading>, Page/Section <section_number>)\n<content>`
4. **Step 4:** Call `generateStructured()` (`temperature: 0`) with a strict Zod schema:
   ```ts
   export const RagAnswerSchema = z.object({
     abstained: z.boolean().describe("True if the provided context does not contain the answer"),
     answer: z.string().describe("Answer based strictly on context, or 'I don't know based on the provided documents.'"),
     citations: z.array(z.object({
       source_file: z.string(),
       heading: z.string(),
       section_number: z.number(),
       quote_or_reason: z.string()
     }))
   });
   ```
5. Return both the structured `RagAnswer` **and** the raw `retrieved_chunks` (with cosine similarity scores) so the React UI can display both.

### Phase 5: `Bun.serve` Backend API (`src/server.ts`) & React + shadcn/ui Frontend (`web/`)
1. **REST API Endpoints (`src/server.ts` using `Bun.serve({ routes: { ... } })`):**
   - `GET /api/docs` -> List all ingested documents from Postgres (`source_file`, `file_type`, `section_count`, `chunk_count`, `ingested_at`).
   - `GET /api/docs/:id/chunks` -> View all stored chunks and metadata for a document.
   - `POST /api/docs/upload` -> Parse `req.formData()`, write file to `data/docs/` via `Bun.write()`, and immediately ingest into Qdrant & Postgres.
   - `POST /api/docs/sync` -> Scan `data/docs/` folder and ingest any new/changed files.
   - `DELETE /api/docs/:id` -> Remove document from `data/docs/`, Postgres, and Qdrant.
   - `POST /api/ask` -> Body `{ question: string, source_file?: string }` -> Returns `{ answer, abstained, citations, retrieved_chunks, latency_ms }`.
   - `GET /api/eval` -> Get latest Golden Set evaluation run results from Postgres.
   - `POST /api/eval/run` -> Trigger the 10-question `eval/golden.json` suite and return detailed pass/fail results.
2. **React + shadcn/ui Views (`web/src/`):**
   - Initialize inside `web/` with Vite (`react-ts`), Tailwind CSS, and **shadcn/ui** components (`Tabs`, `Card`, `Badge`, `Button`, `Input`, `Select`, `Table`, `Sheet`, `Progress`, `ScrollArea`, `Alert`).
   - **Tab 1 — Ask & Inspect (`AskTab.tsx`):**
     - shadcn `<Input>` for the question + `<Select>` dropdown to filter by a specific document (or "All Documents").
     - Quick-test pill buttons for sample answerable & unanswerable questions.
     - Answer `<Card>` showing:
       - Emerald `<Badge>` (**"Grounded Answer"**) or Amber `<Badge variant="secondary">` (**"Abstained — Not in Docs"**).
       - Grounded answer text and citation cards with `source_file`, `heading` (`Page N`), and extracted quote.
     - Right/bottom panel displaying the **Top-5 Retrieved Chunks** from Qdrant with `<Progress>` similarity bars (e.g., `84.2%`), `source_file`, `heading`, and chunk text.
   - **Tab 2 — Documents & Chunks (`DocsTab.tsx`):**
     - Drag-and-drop upload card for `.pdf`, `.md`, `.txt`, `.docx`, `.html`, `.json` files + "Sync `data/docs/`" `<Button>`.
     - shadcn `<Table>` of indexed documents showing file type badge, section/page count, chunk count, and an **"Inspect Chunks"** `<Sheet>` slide-over drawer to browse every chunk and its metadata.
   - **Tab 3 — Golden Set Evaluation (`EvalTab.tsx`):**
     - **"Run 10-Question Eval"** `<Button>` + summary KPI `<Card>`s (Total Score `X/10`, Retrieval Hit Rate, Abstention Accuracy).
     - shadcn `<Table>` showing each question, expected source/page, `Retrieval Hit` badge, `Citation/Abstain` badge, and the LLM's actual response.

---

## 5. Prerequisites & Commands
```bash
# 1. Pull the multilingual embedding model in Ollama (and a local LLM if not using OpenRouter)
ollama pull bge-m3
ollama pull qwen2.5:7b-instruct

# 2. Start Qdrant & Postgres in Docker
bun run infra:up

# 3. Install dependencies (root + web)
bun install && cd web && bun install && cd ..

# 4. Start Bun Backend API (:3000) + Vite React UI (:5173)
bun run dev

# CLI commands:
bun run ingest                  # Ingest all files in data/docs/
bun run ingest --force          # Force re-ingest all files
bun run ask "Your question"     # Query from terminal
bun run eval                    # Run the 10-question Golden Set evaluation
```
```