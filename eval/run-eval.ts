import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { sql } from "../src/db/postgres";
import { retrieve } from "../src/retrieval/retrieve";
import type { EvalCase } from "../src/types";

export interface EvalCaseResult {
  id: string | number;
  question: string;
  passed: boolean;
  retrieval_hit: boolean;
  should_abstain?: boolean;
  abstained: boolean;
  cited_sources: string[];
  answer: string;
  latency_ms: number;
}

export interface EvalRunSummary {
  run_id: string;
  run_at: Date;
  total_questions: number;
  passed_count: number;
  pass_rate: number;
  retrieval_hit_rate: number;
  abstention_accuracy: number;
  results: EvalCaseResult[];
}

export async function loadGoldenSet(filePath?: string): Promise<EvalCase[]> {
  const targetPath = filePath || resolve(process.cwd(), "eval/golden.json");
  const file = Bun.file(targetPath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Golden set file not found at: ${targetPath}`);
  }
  return (await file.json()) as EvalCase[];
}

export async function runGoldenEvaluation(options?: {
  goldenCases?: EvalCase[];
  persist?: boolean;
  retrieveFn?: typeof retrieve;
}): Promise<EvalRunSummary> {
  const goldenCases = options?.goldenCases || (await loadGoldenSet());
  const shouldPersist = options?.persist ?? true;
  const retrieveHandler = options?.retrieveFn || retrieve;
  const runId = randomUUID();
  const runAt = new Date();

  const results: EvalCaseResult[] = [];
  let retrievalHits = 0;
  let correctAbstentions = 0;
  let totalAnswerable = 0;
  let totalUnanswerable = 0;

  for (const testCase of goldenCases) {
    const isUnanswerable = testCase.should_abstain === true;
    if (isUnanswerable) {
      totalUnanswerable++;
    } else {
      totalAnswerable++;
    }

    const res = await retrieveHandler(testCase.question);
    const citedSources = (res.citations || []).map((c) => c.source_file);

    let retrievalHit = false;
    let passed = false;

    if (isUnanswerable) {
      // Unanswerable questions succeed when the system properly abstains
      retrievalHit = true;
      if (res.abstained) {
        correctAbstentions++;
        passed = true;
      }
    } else {
      // Answerable questions require retrieval of ground truth doc and no abstention
      const hit = res.retrieved_chunks.some(
        (chunk) => chunk.source_file === testCase.ground_truth_doc
      );
      if (hit) {
        retrievalHits++;
        retrievalHit = true;
      }
      const validCitation =
        !testCase.ground_truth_doc ||
        citedSources.includes(testCase.ground_truth_doc);

      passed = retrievalHit && !res.abstained && validCitation;
    }

    const caseResult: EvalCaseResult = {
      id: testCase.id,
      question: testCase.question,
      passed,
      retrieval_hit: retrievalHit,
      should_abstain: isUnanswerable,
      abstained: res.abstained,
      cited_sources: citedSources,
      answer: res.answer,
      latency_ms: res.latency_ms ?? 0,
    };

    results.push(caseResult);

    if (shouldPersist) {
      try {
        await sql`
          INSERT INTO eval_results (
            run_id,
            run_at,
            question,
            passed,
            abstained,
            retrieval_hit,
            cited_sources,
            answer
          ) VALUES (
            ${runId},
            ${runAt},
            ${testCase.question},
            ${passed},
            ${res.abstained},
            ${retrievalHit},
            ${sql.json(citedSources)},
            ${res.answer}
          )
        `;
      } catch (err: any) {
        console.warn(`[WARN] Failed to persist eval result for question ${testCase.id}:`, err?.message || err);
      }
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;
  const retrievalHitRate =
    totalAnswerable > 0 ? (retrievalHits / totalAnswerable) * 100 : 100;
  const abstentionAccuracy =
    totalUnanswerable > 0 ? (correctAbstentions / totalUnanswerable) * 100 : 100;

  return {
    run_id: runId,
    run_at: runAt,
    total_questions: results.length,
    passed_count: passedCount,
    pass_rate: Number(passRate.toFixed(1)),
    retrieval_hit_rate: Number(retrievalHitRate.toFixed(1)),
    abstention_accuracy: Number(abstentionAccuracy.toFixed(1)),
    results,
  };
}

async function main() {
  console.log("\n\x1b[1m=== Running 10-Question Golden Set Evaluation ===\x1b[0m\n");

  try {
    const summary = await runGoldenEvaluation({ persist: true });

    console.log("-------------------------------------------------------------------------------------------------------");
    console.log(
      `| #  | Status | Hit? | Abstain? | Question Preview                                            | Latency |`
    );
    console.log("-------------------------------------------------------------------------------------------------------");

    for (const r of summary.results) {
      const statusBadge = r.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
      const hitBadge = r.should_abstain
        ? "\x1b[90mN/A \x1b[0m"
        : r.retrieval_hit
        ? "\x1b[32mYES \x1b[0m"
        : "\x1b[31mNO  \x1b[0m";
      const abstainBadge = r.abstained ? "\x1b[33mYES \x1b[0m" : "\x1b[36mNO  \x1b[0m";
      const preview = r.question.length > 55 ? r.question.slice(0, 52) + "..." : r.question.padEnd(55, " ");
      const latency = `${r.latency_ms}ms`.padStart(7, " ");

      console.log(
        `| ${String(r.id).padEnd(2, " ")} | ${statusBadge}   | ${hitBadge} | ${abstainBadge}    | ${preview} | ${latency} |`
      );
    }

    console.log("-------------------------------------------------------------------------------------------------------");
    console.log(`\n\x1b[1mEvaluation Summary:\x1b[0m`);
    console.log(`  Run ID:               \x1b[36m${summary.run_id}\x1b[0m`);
    console.log(`  Total Questions:      ${summary.total_questions}`);
    console.log(`  Passed:               \x1b[32m${summary.passed_count}/${summary.total_questions} (${summary.pass_rate}%)\x1b[0m`);
    console.log(`  Retrieval Hit Rate:   \x1b[32m${summary.retrieval_hit_rate}%\x1b[0m`);
    console.log(`  Abstention Accuracy:  \x1b[32m${summary.abstention_accuracy}%\x1b[0m`);
    console.log(`\nResults successfully logged to PostgreSQL \x1b[33meval_results\x1b[0m table.\n`);

    await sql.end();
  } catch (err: any) {
    console.error(`\x1b[31mEvaluation failed:\x1b[0m`, err?.message || err);
    await sql.end();
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
