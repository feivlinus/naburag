# Design

## Context

Phase 1–3 established the Bun runtime, Docker containers (PostgreSQL 16 + Qdrant), database schemas, document parsers, chunking, and the ingestion pipeline (`bun run ingest`). The ingested corpus in `data/docs/` contains heterogeneous documents in German and English (`.pdf`, `.md`, `.txt`, `.docx`, `.html`, `.json`) indexed into the Qdrant `docs` collection using 1024-dimensional `bge-m3` embeddings.

Phase 4 introduces the retrieval engine and evaluation layer. It bridges the stored vectors in Qdrant and the LLM client in `src/llm.ts` to deliver grounded question answering with verifiable citations, strict abstention on out-of-scope queries, and an automated benchmark evaluation suite.

## Goals / Non-Goals

**Goals:**
- Provide a clean, standalone retrieval module `retrieve(question, options)` returning both the structured `RagAnswer` and raw `RetrievedChunk[]` with cosine similarity scores.
- Support optional document filtering (`source_file`) at retrieval time using native Qdrant payload filters.
- Enforce strict JSON output schema (`RagAnswerSchema`) via `generateStructured()` ensuring unambiguous citations and reliable `abstained` flag detection.
- Provide a responsive Bun CLI tool `src/retrieval/ask.ts` (`bun run ask "<question>"`).
- Define a realistic 10-question multilingual benchmark dataset in `eval/golden.json` (8 grounded questions covering different file formats and languages + 2 unanswerable control queries).
- Provide an automated evaluation runner in `eval/run-eval.ts` (`bun run eval`) that scores runs and logs every test result to the PostgreSQL `eval_results` table with a shared `run_id`.

**Non-Goals:**
- Web UI and HTTP REST endpoints (deferred to Phase 5).
- Re-ranking models (Cross-Encoder / Cohere Rerank) — direct Qdrant vector search with `bge-m3` meets the latency and accuracy requirements without extra heavy dependencies.
- Multi-query or agentic iterative retrieval loops — single-step deterministic retrieval keeps latency low and behavior predictable.

## Decisions

### 1. Vector Search + Payload Extraction
- **Choice**: Call Qdrant REST client `qdrant.search('docs', { vector, limit: 5, with_payload: true, filter })`.
- **Rationale**: Direct vector search on Qdrant using the official `@qdrant/js-client-rest` client is lightweight and already configured in `src/db/qdrant.ts`.
- **Alternatives considered**: Bun.sql pgvector (rejected in initial architecture to keep vector search isolated in Qdrant with HNSW indexing and dedicated payload filtering).

### 2. Prompt Formatting and Strict Zod Structured Output
- **Choice**: Format retrieved chunks as numbered blocks (`[1] Source: <source_file> (<heading>, Page/Section <section_number>)\n<content>`) and validate LLM outputs against a Zod schema (`RagAnswerSchema`) containing `abstained: boolean`, `answer: string`, and `citations: array`.
- **Rationale**: `src/llm.ts` already provides `generateStructured()` using OpenAI-compatible JSON Schema enforcement (`response_format: { type: "json_schema" }`) and Zod validation, guaranteeing 100% parseable structured responses.
- **Alternatives considered**: Raw string prompts with regex citation extraction (rejected due to fragility, hallucinated syntax, and parsing errors).

### 3. CLI Interface Design (`bun run ask`)
- **Choice**: Parse arguments from `process.argv` supporting positional questions and `--filter <source_file>` flag. Output formatted markdown with terminal color badges for Grounded vs. Abstained status, similarity score bars, and citation blocks.
- **Rationale**: Zero external CLI parser dependencies needed; native Node/Bun argument parsing keeps the runtime dependency-free.

### 4. Golden Set Evaluation Architecture
- **Choice**: Store benchmark QA pairs in `eval/golden.json` and execute via `eval/run-eval.ts`. Check three core criteria:
  1. **Retrieval Hit**: Did the expected ground-truth document appear in the top-5 retrieved chunks?
  2. **Abstention Accuracy**: Did the model properly abstain when `should_abstain: true` (and refrain from abstaining when answerable)?
  3. **Citation Validity**: Did cited sources point to the expected document?
- Results are inserted into the PostgreSQL `eval_results` table initialized in `src/db/postgres.ts`, enabling historical tracking across runs.

## Risks / Trade-offs

- **[Risk]** Context chunk size limit or token budget overflow if top-5 chunks are excessively large.
  - **Mitigation**: Chunks are deterministic and bounded at ~800 characters by `src/ingest/chunker.ts`. 5 chunks total ~4,000 characters (~1,000 tokens), well within standard LLM context windows (e.g. 8k–32k tokens).
- **[Risk]** LLM hallucinating facts despite instructions to abstain.
  - **Mitigation**: Temperature set to 0, system prompt strictly commands abstention when facts are missing, and JSON Schema enforces boolean `abstained` flag.
- **[Risk]** Database connection failure during evaluation logging.
  - **Mitigation**: Wrap PostgreSQL inserts in try/catch in `run-eval.ts` so terminal summary output still displays even if DB logging encounters a transient error.
