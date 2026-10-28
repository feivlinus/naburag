# document-retrieval Specification

## Purpose
Enables deterministic vector similarity search across ingested document chunks, context assembly, grounded question answering with exact inline citations, out-of-scope abstention, and terminal querying.

## Requirements

### Requirement: Top-K Vector Similarity Retrieval
The system SHALL accept a natural language query, compute its dense embedding using the configured embedding model, and retrieve the top-5 most relevant document chunks from the vector database with cosine similarity scores.

#### Scenario: Basic similarity retrieval
- **WHEN** a natural language question is submitted for retrieval
- **THEN** the system generates a 1024-dimensional query embedding, queries the `docs` collection in Qdrant for the top 5 chunks with payload and similarity score, and returns them in descending order of similarity

#### Scenario: Filtered retrieval by source file
- **WHEN** a retrieval query includes an optional `source_file` filter parameter
- **THEN** the system filters the Qdrant query to match only chunks belonging to the specified `source_file` and returns the top 5 matching chunks

### Requirement: Structured Grounded Answer Generation
The system SHALL construct an indexed context prompt from retrieved chunks and invoke the LLM to generate a structured JSON response containing the answer, exact citation references, and an abstention flag.

#### Scenario: Answerable question grounded in retrieved context
- **WHEN** the retrieved context blocks contain factual information answering the user's question
- **THEN** the system generates an answer grounded strictly in the context, sets `abstained` to `false`, and includes citations with `source_file`, `heading`, and `section_number` for each referenced fact

#### Scenario: Unanswerable or out-of-scope question
- **WHEN** the user question cannot be answered using the provided context chunks
- **THEN** the system sets `abstained` to `true`, outputs an explicit abstention message indicating the information is not in the provided documents, and returns an empty or explanatory citation list

### Requirement: Combined Query Result Presentation
The retrieval service SHALL return both the structured LLM response and the raw retrieved chunk records including their source metadata and cosine similarity scores.

#### Scenario: Retrieval response payload structure
- **WHEN** a question is processed through the retrieval pipeline
- **THEN** the returned object contains `answer` (string), `abstained` (boolean), `citations` (array of source citations), and `retrieved_chunks` (array of top chunks with score, source_file, heading, section_number, and content)

### Requirement: CLI Question Answering Entrypoint
The system SHALL provide a CLI command allowing users to execute queries directly from the command line with optional document filtering.

#### Scenario: Executing a query via CLI
- **WHEN** a user executes `bun run ask "<question>"` from the terminal
- **THEN** the command runs the retrieval pipeline and prints the grounded answer, abstention status, citations, and top retrieved chunks with similarity percentages to stdout

#### Scenario: Executing a query with file filter via CLI
- **WHEN** a user executes `bun run ask "<question>" --filter "<source_file>"`
- **THEN** the query restricts retrieval to the specified document and displays the filtered results
