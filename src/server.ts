import path from "node:path";
import fs from "node:fs/promises";
import { config } from "./config";
import { sql, initPostgres } from "./db/postgres";
import { qdrant, initQdrant, COLLECTION_NAME } from "./db/qdrant";
import { ingestFile, ingestCorpus, SUPPORTED_EXTENSIONS } from "./ingest/ingest";
import { retrieve } from "./retrieval/retrieve";
import { runGoldenEvaluation } from "../eval/run-eval";
import type { DocumentRecord } from "./types";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

let storesInitialized = false;

export async function ensureStoresInitialized() {
  if (!storesInitialized) {
    await initPostgres();
    await initQdrant();
    storesInitialized = true;
  }
}

export function createServer(options?: {
  port?: number;
  docsDir?: string;
  distDir?: string;
  retrieveFn?: typeof retrieve;
  runEvalFn?: typeof runGoldenEvaluation;
}) {
  const port = options?.port ?? config.PORT ?? 3000;
  const docsDir = options?.docsDir ?? path.resolve("data/docs");
  const distDir = options?.distDir ?? path.resolve("web/dist");
  const retrieveHandler = options?.retrieveFn ?? retrieve;
  const runEvalHandler = options?.runEvalFn ?? runGoldenEvaluation;

  // Initialize backing stores once at startup
  ensureStoresInitialized().catch((err) => {
    console.error("Failed to initialize backing stores:", err);
  });

  return Bun.serve({
    port,
    async fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      const url = new URL(req.url);
      const pathname = url.pathname;

      try {
        // Health check
        if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
          return json({ status: "ok" });
        }

        // GET /api/docs - List documents
        if (req.method === "GET" && pathname === "/api/docs") {
          await ensureStoresInitialized();
          const docs = await sql<DocumentRecord[]>`
            SELECT id, source_file, file_type, file_hash, section_count, chunk_count, ingested_at
            FROM documents
            ORDER BY ingested_at DESC
          `;
          return json(docs);
        }

        // GET /api/docs/:id/chunks - Inspect chunks for document
        const chunksMatch = pathname.match(/^\/api\/docs\/(\d+)\/chunks$/);
        if (req.method === "GET" && chunksMatch) {
          const docId = parseInt(chunksMatch[1], 10);
          await ensureStoresInitialized();

          const [doc] = await sql`
            SELECT id, source_file FROM documents WHERE id = ${docId} LIMIT 1
          `;
          if (!doc) {
            return json({ error: "Document not found" }, 404);
          }

          const chunks = await sql`
            SELECT chunk_id, section_number, heading, content
            FROM chunks
            WHERE document_id = ${docId}
            ORDER BY section_number ASC, chunk_id ASC
          `;
          return json(chunks);
        }

        // DELETE /api/docs/:id - Delete document across disk, postgres, and qdrant
        const deleteMatch = pathname.match(/^\/api\/docs\/(\d+)$/);
        if (req.method === "DELETE" && deleteMatch) {
          const docId = parseInt(deleteMatch[1], 10);
          await ensureStoresInitialized();

          const [doc] = await sql`
            SELECT id, source_file FROM documents WHERE id = ${docId} LIMIT 1
          `;
          if (!doc) {
            return json({ error: "Document not found" }, 404);
          }

          // Delete from disk if present (sanitized against traversal)
          const safeFileName = path.basename(doc.source_file);
          const filePath = path.join(docsDir, safeFileName);
          try {
            await fs.unlink(filePath);
          } catch {
            // Ignore if file doesn't exist on disk
          }

          // Delete from Qdrant
          await qdrant.delete(COLLECTION_NAME, {
            filter: {
              must: [{ key: "source_file", match: { value: doc.source_file } }],
            },
          });

          // Delete from PostgreSQL (cascades to chunks)
          await sql`
            DELETE FROM documents WHERE id = ${docId}
          `;

          return json({ success: true, message: `Deleted document ${doc.source_file}` });
        }

        // POST /api/docs/upload - Upload and ingest document
        if (req.method === "POST" && pathname === "/api/docs/upload") {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;

          if (!file || typeof file === "string") {
            return json({ error: "No file provided in 'file' form field" }, 400);
          }

          const safeFileName = path.basename(file.name);
          const ext = path.extname(safeFileName).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.has(ext)) {
            return json(
              { error: `Unsupported file extension '${ext}'. Supported: ${Array.from(SUPPORTED_EXTENSIONS).join(", ")}` },
              400
            );
          }

          await fs.mkdir(docsDir, { recursive: true });
          const targetPath = path.join(docsDir, safeFileName);
          await Bun.write(targetPath, file);

          const result = await ingestFile(targetPath, true);
          if (!result.documentId || result.chunkCount === 0) {
            return json(
              { error: `Uploaded document '${safeFileName}' contains no extractable text or content` },
              400
            );
          }

          const docs = await sql<DocumentRecord[]>`
            SELECT id, source_file, file_type, file_hash, section_count, chunk_count, ingested_at
            FROM documents
            WHERE id = ${result.documentId}
          `;
          const doc = docs[0];

          return json(doc, 201);
        }

        // POST /api/docs/sync - Sync local docs directory
        if (req.method === "POST" && pathname === "/api/docs/sync") {
          const result = await ingestCorpus({ docsDir, force: false });
          return json({ success: true, ...result });
        }

        // POST /api/ask - Retrieval question answering
        if (req.method === "POST" && pathname === "/api/ask") {
          const body = (await req.json().catch(() => ({}))) as {
            question?: string;
            source_file?: string;
          };

          if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
            return json({ error: "Field 'question' is required and must be a non-empty string" }, 400);
          }

          const answer = await retrieveHandler(body.question.trim(), {
            source_file: body.source_file?.trim() || undefined,
          });

          return json(answer);
        }

        // GET /api/eval - Fetch latest evaluation run
        if (req.method === "GET" && pathname === "/api/eval") {
          await ensureStoresInitialized();

          const [latestRun] = await sql<[{ run_id: string; run_at: Date }?]>`
            SELECT run_id, run_at FROM eval_results ORDER BY run_at DESC LIMIT 1
          `;

          if (!latestRun) {
            return json({
              run_id: null,
              run_at: null,
              total_questions: 0,
              passed_count: 0,
              pass_rate: 0,
              retrieval_hit_rate: 0,
              abstention_accuracy: 0,
              results: [],
            });
          }

          const rows = await sql`
            SELECT id, question, passed, abstained, retrieval_hit, cited_sources, answer
            FROM eval_results
            WHERE run_id = ${latestRun.run_id}
            ORDER BY id ASC
          `;

          const total = rows.length;
          const passedCount = rows.filter((r) => r.passed).length;
          const retrievalHits = rows.filter((r) => r.retrieval_hit).length;
          const correctAbstentions = rows.filter((r) => r.abstained).length;

          return json({
            run_id: latestRun.run_id,
            run_at: latestRun.run_at,
            total_questions: total,
            passed_count: passedCount,
            pass_rate: total > 0 ? passedCount / total : 0,
            retrieval_hit_rate: total > 0 ? retrievalHits / total : 0,
            abstention_accuracy: total > 0 ? correctAbstentions / total : 0,
            results: rows.map((r) => ({
              id: r.id,
              question: r.question,
              passed: r.passed,
              abstained: r.abstained,
              retrieval_hit: r.retrieval_hit,
              cited_sources: r.cited_sources,
              answer: r.answer,
            })),
          });
        }

        // POST /api/eval/run - Trigger Golden Set evaluation
        if (req.method === "POST" && pathname === "/api/eval/run") {
          const summary = await runEvalHandler({ persist: true });
          return json(summary);
        }

        // Static files fallback for web/dist (Single Page App)
        if (req.method === "GET" && !pathname.startsWith("/api/")) {
          const resolvedDist = path.resolve(distDir);
          let decodedPath = pathname;
          try {
            decodedPath = decodeURIComponent(pathname);
          } catch {
            return json({ error: "Invalid path encoding" }, 400);
          }

          // Defense against directory traversal
          if (decodedPath.includes("..")) {
            return json({ error: "Access denied" }, 403);
          }

          const candidatePath = path.resolve(resolvedDist, "." + decodedPath);
          if (!candidatePath.startsWith(resolvedDist)) {
            return json({ error: "Access denied" }, 403);
          }

          const file = Bun.file(candidatePath);
          if (await file.exists()) {
            return new Response(file);
          }

          // Fallback to index.html only for client-side navigation (routes without extension or html)
          const ext = path.extname(decodedPath);
          if (!ext || ext === ".html") {
            const indexPath = path.join(resolvedDist, "index.html");
            const indexFile = Bun.file(indexPath);
            if (await indexFile.exists()) {
              return new Response(indexFile, {
                headers: { "Content-Type": "text/html" },
              });
            }
          }

          return json({ error: `Not found: ${pathname}` }, 404);
        }

        return json({ error: `Not found: ${pathname}` }, 404);
      } catch (err: any) {
        console.error(`[Server Error] ${req.method} ${pathname}:`, err);
        return json({ error: err?.message || "Internal server error" }, 500);
      }
    },
  });
}

// Entrypoint for bun run src/server.ts
if (import.meta.main) {
  const server = createServer();
  console.log(`RAG Server running at http://localhost:${server.port}`);
}
