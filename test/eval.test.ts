import { describe, it, expect } from "bun:test";
import { sql } from "../src/db/postgres";
import { loadGoldenSet, runGoldenEvaluation } from "../eval/run-eval";
import type { EvalCase } from "../src/types";

describe("Golden Set Evaluation Suite", () => {
  it("loads and validates the 10-question golden dataset", async () => {
    const goldenCases = await loadGoldenSet();

    expect(goldenCases.length).toBe(10);

    const answerable = goldenCases.filter((c) => !c.should_abstain);
    const unanswerable = goldenCases.filter((c) => c.should_abstain);

    expect(answerable.length).toBe(8);
    expect(unanswerable.length).toBe(2);

    for (const c of answerable) {
      expect(c.question.length).toBeGreaterThan(10);
      expect(c.ground_truth_doc).toBeDefined();
      expect(c.expected_answer).toBeDefined();
    }

    for (const c of unanswerable) {
      expect(c.question.length).toBeGreaterThan(10);
      expect(c.should_abstain).toBe(true);
    }
  });

  it("calculates accuracy metrics and persists results to PostgreSQL eval_results", async () => {
    const testCases: EvalCase[] = [
      {
        id: "t1",
        question: "Answerable with hit and correct citation",
        ground_truth_doc: "doc_a.md",
        should_abstain: false,
      },
      {
        id: "t2",
        question: "Answerable but missed retrieval hit",
        ground_truth_doc: "doc_b.md",
        should_abstain: false,
      },
      {
        id: "t3",
        question: "Unanswerable and properly abstained",
        should_abstain: true,
      },
      {
        id: "t4",
        question: "Unanswerable but falsely answered",
        should_abstain: true,
      },
    ];

    // Mock retrieve function
    const mockRetrieve = (async (question: string) => {
      if (question === "Answerable with hit and correct citation") {
        return {
          abstained: false,
          answer: "Ground truth answer.",
          citations: [
            {
              source_file: "doc_a.md",
              heading: "Heading",
              section_number: 1,
              quote_or_reason: "Quote",
            },
          ],
          retrieved_chunks: [
            {
              chunk_id: "c1",
              source_file: "doc_a.md",
              heading: "Heading",
              section_number: 1,
              content: "Content",
              score: 0.9,
            },
          ],
          latency_ms: 50,
        };
      }
      if (question === "Answerable but missed retrieval hit") {
        return {
          abstained: false,
          answer: "Irrelevant answer.",
          citations: [
            {
              source_file: "other.md",
              heading: "Heading",
              section_number: 1,
              quote_or_reason: "Quote",
            },
          ],
          retrieved_chunks: [
            {
              chunk_id: "c2",
              source_file: "other.md",
              heading: "Heading",
              section_number: 1,
              content: "Content",
              score: 0.4,
            },
          ],
          latency_ms: 45,
        };
      }
      if (question === "Unanswerable and properly abstained") {
        return {
          abstained: true,
          answer: "I don't know based on the provided documents.",
          citations: [],
          retrieved_chunks: [],
          latency_ms: 30,
        };
      }
      // Falsely answered unanswerable question
      return {
        abstained: false,
        answer: "Hallucinated answer.",
        citations: [],
        retrieved_chunks: [],
        latency_ms: 40,
      };
    }) as any;

    const summary = await runGoldenEvaluation({
      goldenCases: testCases,
      persist: true,
      retrieveFn: mockRetrieve,
    });

      expect(summary.total_questions).toBe(4);
      expect(summary.passed_count).toBe(2); // t1 passed, t3 passed
      expect(summary.pass_rate).toBe(50.0);
      expect(summary.retrieval_hit_rate).toBe(50.0); // 1 of 2 answerable hit
      expect(summary.abstention_accuracy).toBe(50.0); // 1 of 2 unanswerable abstained

      // Verify persistence in PostgreSQL eval_results
      const savedRows = await sql`
        SELECT * FROM eval_results WHERE run_id = ${summary.run_id} ORDER BY question ASC
      `;

      expect(savedRows.length).toBe(4);
      const passedRows = savedRows.filter((r) => r.passed);
      expect(passedRows.length).toBe(2);
  });
});
