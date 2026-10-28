# Spec Delta

## Purpose

Defines a 10-question multilingual benchmark dataset and an automated evaluation runner that scores retrieval accuracy, answer grounding, and abstention behavior while recording metrics in PostgreSQL.

## ADDED Requirements

### Requirement: Multilingual Golden Evaluation Dataset
The system SHALL maintain a structured 10-question evaluation dataset in JSON containing 8 answerable queries across German and English corpus documents and 2 unanswerable control queries.

#### Scenario: Dataset structure and coverage
- **WHEN** the golden evaluation dataset is loaded from `eval/golden.json`
- **THEN** it contains exactly 10 test cases, each specifying an `id`, `question`, expected behavior (`should_abstain: true` for the 2 control questions, or `ground_truth_doc` and key verification criteria for the 8 answerable questions)

### Requirement: Automated Evaluation Execution and Scoring
The system SHALL provide an automated evaluation runner that executes the retrieval pipeline against all benchmark questions and evaluates retrieval recall, abstention correctness, and citation accuracy.

#### Scenario: Running the evaluation suite
- **WHEN** the user executes `bun run eval`
- **THEN** the runner evaluates all 10 questions sequentially, checks whether expected documents appear in retrieved top-5 chunks, checks whether abstention matches `should_abstain`, and computes summary KPI metrics (total score, retrieval hit rate, and abstention rate)

### Requirement: Evaluation Run Persistence
The evaluation runner SHALL persist the detailed results of each benchmark execution into the relational database for auditability and regression tracking.

#### Scenario: Storing evaluation run results in PostgreSQL
- **WHEN** an evaluation run completes
- **THEN** a shared `run_id` UUID is generated, and a record for each question is inserted into the `eval_results` table containing `run_id`, `run_at`, `question`, `passed`, `abstained`, `retrieval_hit`, `cited_sources`, and generated `answer`
