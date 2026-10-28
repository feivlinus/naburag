# Spec Delta

## Purpose

Provides deterministic, idempotent multi-format document parsing, paragraph/word-boundary chunking, batched vector embedding, and synchronized storage across PostgreSQL and Qdrant for the local RAG pipeline.

## ADDED Requirements

### Requirement: Local Backing Store Initialization
The system SHALL initialize and verify required storage schemas in both the relational database (`documents`, `chunks`, and `eval_results` tables) and the vector database (`docs` collection configured for 1024-dimensional Cosine similarity vectors) before executing ingestion operations.

#### Scenario: First-time startup with empty databases
- **WHEN** the ingestion service initializes against empty PostgreSQL and Qdrant instances
- **THEN** the system creates the `documents`, `chunks` (with `ON DELETE CASCADE` on `document_id`), and `eval_results` tables in PostgreSQL and creates the `docs` collection (`size: 1024`, `distance: Cosine`) in Qdrant without error

#### Scenario: Subsequent startup with existing schema and collection
- **WHEN** the ingestion service initializes against databases where the tables and `docs` collection already exist
- **THEN** initialization succeeds idempotently without dropping or corrupting existing records or points

### Requirement: Multi-Format Document Discovery and Section Extraction
The system SHALL scan the top-level `data/docs/` directory for supported document files (`.pdf`, `.md`, `.txt`, `.docx`, `.html`, `.htm`, `.json`), ignoring companion asset directories (such as `*_files/`), and normalize each document into an ordered list of sections (`RawSection[]`) containing `source_file`, 1-based `section_number`, `heading`, and extracted `text`.

#### Scenario: Extracting pages from a PDF document
- **WHEN** a `.pdf` file (such as `DSVGO.pdf` or `BGB.pdf`) is loaded
- **THEN** each non-empty page is extracted as a separate `RawSection` with `section_number` equal to the 1-based page number and `heading` set to `"Page <N>"`

#### Scenario: Extracting heading blocks from Markdown and HTML documents
- **WHEN** a `.md`, `.html`, or `.htm` file (such as `legal_memo_eu_ai_act_compliance_mandant.md` or `BSI_-_IT-Grundschutz.htm`) is loaded
- **THEN** non-content markup (`<script>`, `<style>`, `<nav>`, `<footer>` in HTML) is stripped and the text is split by heading boundaries (`#`/`##`/`###` or `<h1>`/`<h2>`/`<h3>`) into `RawSection` items preserving each section's heading text

#### Scenario: Extracting sections from DOCX and plain text documents
- **WHEN** a `.docx` or `.txt` file (such as `EVB_IT_Dienstleistung_Langfassung.docx` or `Die_Verwandlung_Kafka.txt`) is loaded
- **THEN** the raw text is extracted and segmented into logical sections (~3000 characters on paragraph boundaries) with `heading` set to `"Section <N>"`

#### Scenario: Extracting records from structured JSON documents
- **WHEN** a `.json` file (such as `secops_tickets-cve_feed.json`) is loaded
- **THEN** top-level array items or nested object-array items under top-level keys are extracted into individual `RawSection` items with descriptive headings (including record/item identifiers such as `cve_id` or `ticket_id` when present)

#### Scenario: Ignoring companion webpage asset directories
- **WHEN** `data/docs/` contains a saved webpage companion directory such as `BSI_-_IT-Grundschutz_files/` with `.css`, `.js`, `.svg`, or `.png` files
- **THEN** the directory scanner ignores the subdirectory and its non-document assets without error

### Requirement: Deterministic Word-Boundary Chunking and UUIDv5 Identification
The system SHALL split each `RawSection` into chunks of approximately 800 characters with approximately 120 characters of overlap without cutting mid-word, and SHALL assign each chunk a deterministic UUIDv5 `chunk_id` derived from `${source_file}:s${section_number}:c${chunk_index}`.

#### Scenario: Chunking a long section with overlap
- **WHEN** a `RawSection` contains text exceeding 800 characters
- **THEN** the chunker splits the text on paragraph or word boundaries into ~800-character `ChunkPayload` items where consecutive chunks within the same section share ~120 characters of trailing/leading context and no word is split mid-token

#### Scenario: Deterministic chunk ID across repeated runs
- **WHEN** the same document section and chunk index are processed across multiple runs
- **THEN** the generated `chunk_id` is a valid UUIDv5 string that is identical across runs

### Requirement: Batched Embedding Generation
The system SHALL generate 1024-dimensional embeddings for document chunks in bounded batches so that large documents with thousands of chunks do not time out or exhaust memory on the embedding server.

#### Scenario: Embedding a multi-thousand-chunk document
- **WHEN** a large document (such as `BGB.pdf`) produces more chunks than the single-request batch limit
- **THEN** the system requests embeddings in sequential batches and returns a 1024-dimensional float vector for every chunk in order

### Requirement: Idempotent Hash-Checked Ingestion and Force Re-Ingestion
The system SHALL compute a SHA-256 hash of each document file before parsing and skip unchanged documents during normal ingestion, while replacing existing PostgreSQL records and Qdrant points atomically when a file is new, modified, or ingested with `--force`.

#### Scenario: Skipping an unchanged document on re-run
- **WHEN** `bun run ingest` is executed and a document's SHA-256 `file_hash` matches the stored hash in PostgreSQL
- **THEN** the system skips parsing, embedding, and database writes for that document

#### Scenario: Updating a modified document or running with `--force`
- **WHEN** a document's SHA-256 hash differs from the stored record or `bun run ingest --force` is executed
- **THEN** the system deletes existing Qdrant points matching `source_file`, deletes the existing PostgreSQL `documents` row (cascading to `chunks`), and inserts the newly embedded chunks and updated document metadata without leaving orphaned or duplicate chunks
