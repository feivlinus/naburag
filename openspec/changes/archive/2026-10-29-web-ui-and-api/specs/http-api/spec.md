# Spec Delta

## Purpose

Provides a lightweight REST HTTP API served by Bun to manage documents, execute grounded retrieval queries, and trigger benchmark evaluations.

## ADDED Requirements

### Requirement: Document listing and chunk inspection
The system SHALL provide `GET /api/docs` returning all indexed documents and `GET /api/docs/:id/chunks` returning chunk details and section metadata for a specific document.

#### Scenario: List documents
- **WHEN** a client sends a GET request to `/api/docs`
- **THEN** the system returns HTTP 200 with an array of document records including id, source_file, file_type, section_count, chunk_count, and ingested_at

#### Scenario: Inspect document chunks
- **WHEN** a client sends a GET request to `/api/docs/:id/chunks` with a valid document id
- **THEN** the system returns HTTP 200 with an array of chunks including chunk_id, section_number, heading, and content

#### Scenario: Document chunks not found
- **WHEN** a client sends a GET request to `/api/docs/:id/chunks` with a non-existent document id
- **THEN** the system returns HTTP 404 with an error message

### Requirement: Document upload and sync
The system SHALL support multipart file upload via `POST /api/docs/upload` and corpus folder scanning via `POST /api/docs/sync` to ingest new or updated documents.

#### Scenario: Upload valid document
- **WHEN** a client sends a POST request to `/api/docs/upload` containing a supported document file in multipart form data
- **THEN** the system saves the file to `data/docs/`, ingests it into PostgreSQL and Qdrant, and returns HTTP 201 with the created document record

#### Scenario: Synchronize documents directory
- **WHEN** a client sends a POST request to `/api/docs/sync`
- **THEN** the system scans `data/docs/`, ingests new or modified files, and returns HTTP 200 with a summary of ingested and skipped files

### Requirement: Document deletion
The system SHALL support deleting an indexed document via `DELETE /api/docs/:id`, removing its file from disk, its records from PostgreSQL, and its vector embeddings from Qdrant.

#### Scenario: Delete existing document
- **WHEN** a client sends a DELETE request to `/api/docs/:id` with a valid document id
- **THEN** the system deletes the file from `data/docs/`, cascades chunk deletion in PostgreSQL, deletes vector points in Qdrant, and returns HTTP 200

#### Scenario: Delete non-existent document
- **WHEN** a client sends a DELETE request to `/api/docs/:id` for an unknown document id
- **THEN** the system returns HTTP 404 with an error message

### Requirement: Retrieval question answering endpoint
The system SHALL provide `POST /api/ask` accepting a question and optional source_file filter, returning grounded answers, abstention status, citations, retrieved chunks, and query latency.

#### Scenario: Answer query with grounded context
- **WHEN** a client sends a POST request to `/api/ask` with a JSON payload containing `{ "question": "..." }`
- **THEN** the system returns HTTP 200 with answer, abstained boolean, citations array, retrieved_chunks array with similarity scores, and latency_ms

#### Scenario: Missing question in request body
- **WHEN** a client sends a POST request to `/api/ask` without a valid question string
- **THEN** the system returns HTTP 400 with a descriptive validation error

### Requirement: Golden Set evaluation execution and history
The system SHALL provide `POST /api/eval/run` to execute the 10-question evaluation suite and `GET /api/eval` to retrieve the latest evaluation results from PostgreSQL.

#### Scenario: Trigger evaluation run
- **WHEN** a client sends a POST request to `/api/eval/run`
- **THEN** the system executes the evaluation suite, records results in PostgreSQL, and returns HTTP 200 with the run summary and individual test case results

#### Scenario: Fetch latest evaluation run
- **WHEN** a client sends a GET request to `/api/eval`
- **THEN** the system returns HTTP 200 containing the most recent evaluation run summary and question results
