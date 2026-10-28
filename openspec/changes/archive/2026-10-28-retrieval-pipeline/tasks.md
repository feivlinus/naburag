# Tasks

## 1. Type Definitions & Schema Setup

- [x] 1.1 Extend `src/types.ts` with `RetrievedChunk` and `RagResponse` interfaces, ensuring `Citation` supports optional `quote_or_reason`, and verify type checking passes (`docker compose exec app bun x tsc --noEmit`).
- [x] 1.2 Define and export `RagAnswerSchema` in `src/retrieval/retrieve.ts` using Zod, enforcing `abstained: boolean`, `answer: string`, and `citations: array` matching the spec.

## 2. Core Retrieval & Grounded Generation Pipeline

- [x] 2.1 Implement `retrieve(question, options)` in `src/retrieval/retrieve.ts` executing `embedTexts()`, top-5 Qdrant search with cosine similarity and optional `source_file` payload filter, numbered context assembly, and `generateStructured()` invocation with temperature 0.
- [x] 2.2 Create unit tests in `test/retrieve.test.ts` verifying query embedding generation, context block formatting, Qdrant payload mapping, citation extraction, and abstention behavior when context is insufficient.

## 3. CLI Terminal Query Interface

- [x] 3.1 Implement `src/retrieval/ask.ts` accepting a natural language question and optional `--filter <filename>` flag, rendering color-coded status badges, grounded answers, citations, and retrieved chunk cards with similarity percentages.
- [x] 3.2 Add the `"ask": "bun run src/retrieval/ask.ts"` script to `package.json` and verify basic CLI invocation.

## 4. Golden Benchmark Dataset & Automated Evaluation

- [x] 4.1 Create `eval/golden.json` containing 10 benchmark test cases (8 answerable across German and English corpus documents in `data/docs/` and 2 unanswerable control queries) with question IDs, ground-truth documents, and expected abstention flags.
- [x] 4.2 Implement `eval/run-eval.ts` executing the golden benchmark suite sequentially, calculating retrieval hit rate, abstention accuracy, and answer grounding, and persisting run metrics into PostgreSQL's `eval_results` table.
- [x] 4.3 Add `"eval": "bun run eval/run-eval.ts"` to `package.json` and implement unit tests in `test/eval.test.ts` verifying scoring and evaluation persistence logic.

## 5. End-to-End Verification

- [x] 5.1 Run the full test suite (`docker compose exec app bun test`) and type check (`docker compose exec app bun x tsc --noEmit`) to verify all modules and tests pass cleanly.
- [x] 5.2 Execute an end-to-end evaluation benchmark run (`docker compose exec app bun run eval`) verifying that evaluation metrics are printed to terminal and recorded in PostgreSQL `eval_results`.
