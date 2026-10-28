# Proposal

## Why

With foundation infrastructure and idempotent document ingestion established in Phase 1–3, the RAG system now requires the core retrieval and generation engine to answer user queries from ingested documents. Implementing deterministic vector search, strict structured LLM generation with explicit abstention, and a 10-question golden evaluation suite completes Phase 4, enabling verified question answering and automated benchmark tracking via Bun CLI before building the Web UI and HTTP API in Phase 5.

## What Changes

- Implement top-k vector similarity search against Qdrant (`docs` collection) in `src/retrieval/retrieve.ts` with optional `source_file` filtering and score calculation.
- Implement grounded answer generation with inline citations and explicit abstention using `generateStructured()` with strict Zod validation (`RagAnswerSchema`) in `src/retrieval/retrieve.ts`.
- Expose the Bun CLI question-answering command in `src/retrieval/ask.ts` (`bun run ask "<question>"` and `bun run ask "<question>" --filter <file>`).
- Construct the multilingual 10-question Golden Set in `eval/golden.json` (8 answerable across German and English corpus documents + 2 unanswerable control questions).
- Implement the automated evaluation runner in `eval/run-eval.ts` (`bun run eval`), measuring retrieval hit rate, abstention accuracy, and answer grounding, and persisting evaluation run metrics into PostgreSQL's `eval_results` table.
- Add npm scripts to `package.json` (`ask` and `eval`).

## Capabilities

### New Capabilities
- `document-retrieval`: Vector similarity search against Qdrant, chunk score tracking, context assembly, grounded structured answer generation with citation tracking, out-of-scope abstention handling, and CLI question querying.
- `golden-evaluation`: Multilingual 10-question benchmark dataset specification, automated evaluation execution, scoring against ground truth sources, and historical run persistence in PostgreSQL `eval_results`.

### Modified Capabilities
<!-- None: existing document-ingestion requirements remain unchanged. -->

## Impact

- **New Modules**:
  - `src/retrieval/retrieve.ts`
  - `src/retrieval/ask.ts`
  - `eval/golden.json`
  - `eval/run-eval.ts`
- **Updated Files**:
  - `package.json` (adds `"ask"` and `"eval"` scripts)
- **External Dependencies & Services**: Uses existing Qdrant and PostgreSQL containers, Ollama (`bge-m3` and structured chat model).
- **Breaking Changes**: None.
