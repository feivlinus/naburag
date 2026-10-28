import { retrieve } from "./retrieve";

function printUsage() {
  console.log(`
Usage:
  bun run ask "<question>" [options]

Options:
  --filter <source_file>   Filter search results to a specific document
  -h, --help               Show this help message

Examples:
  bun run ask "What is the EU AI Act compliance timeline?"
  bun run ask "Was regelt das EVB-IT?" --filter EVB_IT_Dienstleistung_Langfassung.docx
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let filterFile: string | undefined;
  const questionParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--filter" && i + 1 < args.length) {
      filterFile = args[++i];
    } else if (arg.startsWith("--filter=")) {
      filterFile = arg.slice(arg.indexOf("=") + 1);
    } else if (!arg.startsWith("--")) {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(" ").trim();
  if (!question) {
    console.error("Error: No question provided.");
    printUsage();
    process.exit(1);
  }

  console.log(`\n\x1b[1mQuerying RAG Pipeline...\x1b[0m`);
  console.log(`Question: \x1b[36m${question}\x1b[0m`);
  if (filterFile) {
    console.log(`Filter:   \x1b[33m${filterFile}\x1b[0m`);
  }
  console.log("--------------------------------------------------------------------------------");

  try {
    const result = await retrieve(question, { source_file: filterFile });

    const statusBadge = result.abstained
      ? "\x1b[43m\x1b[30m [ABSTAINED - NOT IN DOCS] \x1b[0m"
      : "\x1b[42m\x1b[30m [GROUNDED ANSWER] \x1b[0m";

    console.log(`Status:  ${statusBadge}`);
    if (result.latency_ms !== undefined) {
      console.log(`Latency: ${result.latency_ms}ms`);
    }

    console.log(`\n\x1b[1mAnswer:\x1b[0m\n${result.answer}\n`);

    if (result.citations && result.citations.length > 0) {
      console.log(`\x1b[1mCitations (${result.citations.length}):\x1b[0m`);
      for (const [idx, cit] of result.citations.entries()) {
        console.log(
          `  [${idx + 1}] \x1b[36m${cit.source_file}\x1b[0m (${cit.heading}, Page/Section ${cit.section_number})`
        );
        if (cit.quote_or_reason) {
          console.log(`      \x1b[90m"${cit.quote_or_reason}"\x1b[0m`);
        }
      }
      console.log();
    }

    if (result.retrieved_chunks && result.retrieved_chunks.length > 0) {
      console.log(`\x1b[1mTop Retrieved Chunks (${result.retrieved_chunks.length}):\x1b[0m`);
      for (const [idx, chunk] of result.retrieved_chunks.entries()) {
        const scorePercent = (chunk.score * 100).toFixed(1);
        console.log(
          `  [${idx + 1}] \x1b[32m${scorePercent}%\x1b[0m \x1b[36m${chunk.source_file}\x1b[0m (${chunk.heading}, Sec ${chunk.section_number})`
        );
        const preview = chunk.content.replace(/\s+/g, " ").slice(0, 160);
        console.log(`      \x1b[90m${preview}...\x1b[0m`);
      }
    }

    console.log("--------------------------------------------------------------------------------\n");
    process.exit(0);
  } catch (err: any) {
    console.error(`\x1b[31mRetrieval failed:\x1b[0m`, err?.message || err);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
