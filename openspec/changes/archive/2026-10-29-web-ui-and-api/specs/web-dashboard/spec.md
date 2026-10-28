# Spec Delta

## Purpose

Delivers an interactive single-page web dashboard built with React 19 and shadcn/ui for document management, question answering, and benchmark evaluation.

## ADDED Requirements

### Requirement: Ask and Inspect view
The web dashboard SHALL provide an Ask tab with question input, document filter dropdown, quick-test query pills, grounded answer card with citation badges, and retrieved top-5 chunk inspection cards.

#### Scenario: Submitting a question
- **WHEN** a user enters a question and clicks Ask or presses Enter
- **THEN** the dashboard displays the grounded answer, indicates whether the model abstained, renders citation badges, and shows retrieved chunks with similarity progress bars

#### Scenario: Filtering retrieval by document
- **WHEN** a user selects a specific document from the filter dropdown and submits a question
- **THEN** the dashboard submits the selected document filter and displays answers and chunks restricted to that file

### Requirement: Documents and Chunks view
The web dashboard SHALL provide a Documents tab featuring drag-and-drop file upload, folder synchronization, indexed documents table, document deletion, and a slide-over Sheet drawer to inspect chunk breakdowns.

#### Scenario: Uploading a document
- **WHEN** a user drops or selects a supported document file in the upload zone
- **THEN** the dashboard uploads the file via `/api/docs/upload` and updates the indexed documents table

#### Scenario: Inspecting document chunks in drawer
- **WHEN** a user clicks Inspect Chunks on an indexed document row
- **THEN** a slide-over Sheet drawer opens displaying all stored chunks, section numbers, headings, and text content for that document

#### Scenario: Deleting an indexed document
- **WHEN** a user clicks delete on a document row and confirms deletion
- **THEN** the dashboard requests deletion from `/api/docs/:id` and removes the document from the table

### Requirement: Golden Set Evaluation view
The web dashboard SHALL provide an Evaluation tab to trigger the 10-question Golden Set evaluation suite, display summary KPI cards, and render a detailed pass/fail table.

#### Scenario: Running evaluation suite
- **WHEN** a user clicks the Run Golden Set Evaluation button
- **THEN** the dashboard triggers `/api/eval/run`, shows progress, and populates KPI summary cards and the detailed test results table

#### Scenario: Viewing question test case details
- **WHEN** evaluation results are rendered
- **THEN** each test case row displays question text, ground truth expectation, retrieval hit indicator, abstention indicator, and actual model answer
