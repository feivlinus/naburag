import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import path from "node:path";
import fs from "node:fs/promises";
import { createServer } from "../src/server";
import { sql, initPostgres } from "../src/db/postgres";
import { initQdrant } from "../src/db/qdrant";

describe("Bun HTTP Server REST API", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  const testDocsDir = path.resolve("/tmp/rag-server-test-docs");
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    // Mock Ollama embedding calls so tests do not depend on an external Ollama daemon
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/embed")) {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        const inputs = Array.isArray(body.input) ? body.input : [body.input || ""];
        const embeddings = inputs.map(() => new Array(1024).fill(0.05));
        return new Response(JSON.stringify({ embeddings }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, init);
    }) as any;

    await initPostgres();
    await initQdrant();
    await fs.mkdir(testDocsDir, { recursive: true });

    // Start server on a random available port (port: 0) with mock handlers for LLM calls
    const mockRetrieve = async (q: string, opts?: any) => ({
      abstained: false,
      answer: `Mocked answer for: ${q}`,
      citations: [
        {
          source_file: "test_doc.md",
          heading: "## Section 1",
          section_number: 1,
          quote_or_reason: "Direct quote",
        },
      ],
      retrieved_chunks: [
        {
          chunk_id: "c1",
          source_file: "test_doc.md",
          heading: "## Section 1",
          section_number: 1,
          content: "Chunk content",
          score: 0.92,
        },
      ],
      latency_ms: 12,
    });

    const mockRunEval = async () => ({
      run_id: "test-run-123",
      run_at: new Date(),
      total_questions: 10,
      passed_count: 9,
      pass_rate: 0.9,
      retrieval_hit_rate: 1.0,
      abstention_accuracy: 1.0,
      results: [],
    });

    server = createServer({
      port: 0,
      docsDir: testDocsDir,
      retrieveFn: mockRetrieve as any,
      runEvalFn: mockRunEval as any,
    });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    server.stop(true);
    await fs.rm(testDocsDir, { recursive: true, force: true });
  });

  it("responds to CORS preflight OPTIONS requests", async () => {
    const res = await fetch(`${baseUrl}/api/docs`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("responds to /health and /api/health with status ok", async () => {
    const res1 = await fetch(`${baseUrl}/health`);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1).toEqual({ status: "ok" });

    const res2 = await fetch(`${baseUrl}/api/health`);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2).toEqual({ status: "ok" });
  });

  it("lists documents from GET /api/docs", async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    expect(res.status).toBe(200);
    const docs = await res.json();
    expect(Array.isArray(docs)).toBe(true);
  });

  it("handles document upload, chunk inspection, and deletion end-to-end", async () => {
    // 1. Upload a sample text document via multipart/form-data
    const fileContent = "Chapter 1: Quantum Computing Fundamentals.\n\nQuantum bits or qubits can exist in superpositions of states.\n\nChapter 2: Quantum Gates.\nHadamard gates create equal superpositions.";
    const blob = new Blob([fileContent], { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", blob, "quantum_intro.txt");

    const uploadRes = await fetch(`${baseUrl}/api/docs/upload`, {
      method: "POST",
      body: formData,
    });

    expect(uploadRes.status).toBe(201);
    const uploadedDoc = (await uploadRes.json()) as any;
    expect(uploadedDoc).toHaveProperty("id");
    expect(uploadedDoc.source_file).toBe("quantum_intro.txt");
    expect(uploadedDoc.chunk_count).toBeGreaterThan(0);

    const docId = uploadedDoc.id;

    // 2. Inspect chunks via GET /api/docs/:id/chunks
    const chunksRes = await fetch(`${baseUrl}/api/docs/${docId}/chunks`);
    expect(chunksRes.status).toBe(200);
    const chunks = (await chunksRes.json()) as any[];
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBe(uploadedDoc.chunk_count);
    expect(chunks[0]).toHaveProperty("chunk_id");
    expect(chunks[0]).toHaveProperty("content");

    // Inspect non-existent document
    const missingChunksRes = await fetch(`${baseUrl}/api/docs/999999/chunks`);
    expect(missingChunksRes.status).toBe(404);

    // 3. Delete document via DELETE /api/docs/:id
    const deleteRes = await fetch(`${baseUrl}/api/docs/${docId}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    const deleteJson = (await deleteRes.json()) as any;
    expect(deleteJson.success).toBe(true);

    // Verify document is deleted in Postgres
    const [checkDoc] = await sql`SELECT id FROM documents WHERE id = ${docId}`;
    expect(checkDoc).toBeUndefined();

    // Delete non-existent document returns 404
    const deleteMissingRes = await fetch(`${baseUrl}/api/docs/999999`, {
      method: "DELETE",
    });
    expect(deleteMissingRes.status).toBe(404);
  });

  it("rejects invalid upload requests without a file or with unsupported extensions", async () => {
    // Empty form data
    const emptyForm = new FormData();
    const res1 = await fetch(`${baseUrl}/api/docs/upload`, {
      method: "POST",
      body: emptyForm,
    });
    expect(res1.status).toBe(400);

    // Unsupported extension (.exe)
    const badForm = new FormData();
    badForm.append("file", new Blob(["binary"], { type: "application/octet-stream" }), "malware.exe");
    const res2 = await fetch(`${baseUrl}/api/docs/upload`, {
      method: "POST",
      body: badForm,
    });
    expect(res2.status).toBe(400);
    const json2 = (await res2.json()) as any;
    expect(json2.error).toContain("Unsupported file extension");

    // Empty file upload
    const emptyFileForm = new FormData();
    emptyFileForm.append("file", new Blob([""], { type: "text/plain" }), "empty_doc.txt");
    const emptyFileRes = await fetch(`${baseUrl}/api/docs/upload`, {
      method: "POST",
      body: emptyFileForm,
    });
    expect(emptyFileRes.status).toBe(400);
    const emptyFileJson = (await emptyFileRes.json()) as any;
    expect(emptyFileJson.error).toContain("contains no extractable text or content");

    // Path traversal in upload filename is safely sanitized to basename
    const traversalForm = new FormData();
    traversalForm.append(
      "file",
      new Blob(["Heading 1: Secure Upload\n\nContent for traversal defense test."], { type: "text/plain" }),
      "../../traversal_test.txt"
    );
    const traversalRes = await fetch(`${baseUrl}/api/docs/upload`, {
      method: "POST",
      body: traversalForm,
    });
    expect(traversalRes.status).toBe(201);
    const traversalDoc = (await traversalRes.json()) as any;
    expect(traversalDoc.source_file).toBe("traversal_test.txt");
    await fetch(`${baseUrl}/api/docs/${traversalDoc.id}`, { method: "DELETE" });
  });

  it("triggers sync on POST /api/docs/sync", async () => {
    const res = await fetch(`${baseUrl}/api/docs/sync`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data).toHaveProperty("ingestedCount");
    expect(data).toHaveProperty("skippedCount");
  });

  it("validates and answers queries via POST /api/ask", async () => {
    // Empty body or missing question returns 400
    const badRes1 = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(badRes1.status).toBe(400);

    const badRes2 = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "   " }),
    });
    expect(badRes2.status).toBe(400);

    // Valid query
    const validRes = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is an impossible question about aliens on Mars?" }),
    });
    expect(validRes.status).toBe(200);
    const answer = await validRes.json();
    expect(answer).toHaveProperty("abstained");
    expect(answer).toHaveProperty("answer");
    expect(answer).toHaveProperty("citations");
    expect(answer).toHaveProperty("retrieved_chunks");
  });

  it("fetches recent evaluation history on GET /api/eval", async () => {
    const res = await fetch(`${baseUrl}/api/eval`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("run_id");
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("triggers evaluation run on POST /api/eval/run", async () => {
    const res = await fetch(`${baseUrl}/api/eval/run`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const summary = (await res.json()) as any;
    expect(summary.run_id).toBe("test-run-123");
    expect(summary.total_questions).toBe(10);
  });

  it("denies static asset path traversal attempts", async () => {
    const res = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`);
    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error).toBe("Access denied");
  });
});
