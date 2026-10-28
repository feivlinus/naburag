import { describe, it, expect, afterAll } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ingestCorpus } from "../src/ingest/ingest";
import { sql } from "../src/db/postgres";
import { qdrant, COLLECTION_NAME } from "../src/db/qdrant";
import type { DocumentRecord } from "../src/types";

describe("Ingestion Pipeline", () => {
  const originalFetch = globalThis.fetch;
  let testDocsDir: string;

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (testDocsDir) {
      await fs.rm(testDocsDir, { recursive: true, force: true });
    }
  });

  it("ingests sample documents and skips unchanged files on subsequent run", async () => {
    // Mock embedTexts to return 1024-dim vectors deterministically
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/embed")) {
        const body = JSON.parse(init?.body as string);
        const embeddings = body.input.map(() => new Array(1024).fill(0.05));
        return new Response(JSON.stringify({ embeddings }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, init);
    }) as any;

    // Create an isolated temporary test directory with sample fixture files
    testDocsDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-test-docs-"));
    await Bun.write(
      path.join(testDocsDir, "sample_doc.md"),
      "# Overview\nThis is a sample document for testing ingestion.\n\n## Details\nHere are more details about the system.\n",
    );
    await Bun.write(
      path.join(testDocsDir, "sample_memo.txt"),
      "Memo Section 1\n\nThis is a plain text memo for verification.\n",
    );

    // Run first ingestion on the fixture directory
    const firstRun = await ingestCorpus({ docsDir: testDocsDir, force: true });
    expect(firstRun.ingestedCount).toBe(2);

    // Verify postgres has documents and chunks for fixture files
    const docs = await sql<DocumentRecord[]>`
      SELECT * FROM documents WHERE source_file IN ('sample_doc.md', 'sample_memo.txt')
    `;
    expect(docs.length).toBe(2);

    const sampleDoc = docs.find((d) => d.source_file === "sample_doc.md");
    expect(sampleDoc).toBeDefined();
    expect(sampleDoc!.chunk_count).toBeGreaterThan(0);

    // Run second ingestion without force -> all fixture files should be skipped
    const secondRun = await ingestCorpus({ docsDir: testDocsDir, force: false });
    expect(secondRun.skippedCount).toBe(2);
    expect(secondRun.ingestedCount).toBe(0);

    // Verify qdrant points are present for fixture files
    const qdrantCheck = await qdrant.count(COLLECTION_NAME, {
      filter: {
        must: [{ key: "source_file", match: { value: "sample_doc.md" } }],
      },
    });
    expect(qdrantCheck.count).toBeGreaterThan(0);
  });
});
