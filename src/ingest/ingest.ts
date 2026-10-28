import fs from "node:fs/promises";
import path from "node:path";
import { initPostgres, sql } from "../db/postgres";
import { initQdrant, qdrant, COLLECTION_NAME } from "../db/qdrant";
import { loadDocument } from "./doc-loader";
import { chunkSections } from "./chunker";
import { embedTexts } from "../llm";
import type { ChunkPayload, DocumentRecord } from "../types";

export const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".txt",
  ".docx",
  ".html",
  ".htm",
  ".json",
]);

export interface IngestOptions {
  docsDir?: string;
  force?: boolean;
}

export interface IngestFileResult {
  skipped: boolean;
  documentId?: number;
  sourceFile: string;
  fileType: string;
  sectionCount: number;
  chunkCount: number;
}

export async function ingestFile(filePath: string, force = false): Promise<IngestFileResult> {
  await initPostgres();
  await initQdrant();

  const sourceFile = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Compute SHA-256
  const fileBytes = await Bun.file(filePath).bytes();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(fileBytes);
  const fileHash = hasher.digest("hex");

  // Check existing record in Postgres
  const existing = await sql<DocumentRecord[]>`
    SELECT id, file_hash, section_count, chunk_count FROM documents WHERE source_file = ${sourceFile} LIMIT 1
  `;

  if (!force && existing.length > 0 && existing[0].file_hash === fileHash) {
    console.log(`[SKIP] ${sourceFile} is unchanged (SHA-256: ${fileHash.slice(0, 10)}...).`);
    return {
      skipped: true,
      documentId: existing[0].id,
      sourceFile,
      fileType: ext.slice(1),
      sectionCount: existing[0].section_count,
      chunkCount: existing[0].chunk_count,
    };
  }

  console.log(`[INGEST] Processing ${sourceFile}...`);

  // Parse and chunk
  const sections = await loadDocument(filePath);
  const chunks = chunkSections(sections);

  if (chunks.length === 0) {
    console.warn(`[WARN] No chunks generated for ${sourceFile}, skipping.`);
    return {
      skipped: true,
      sourceFile,
      fileType: ext.slice(1),
      sectionCount: sections.length,
      chunkCount: 0,
    };
  }

  console.log(`[INGEST] ${sourceFile}: ${sections.length} sections, ${chunks.length} chunks. Generating embeddings...`);

  // Embed all chunks in batches
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(texts, 64);

  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }

  // Replace points in Qdrant first so that any vector store failure aborts before Postgres commits the new file_hash
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [{ key: "source_file", match: { value: sourceFile } }],
    },
  });

  const QDRANT_BATCH_SIZE = 250;
  for (let i = 0; i < chunks.length; i += QDRANT_BATCH_SIZE) {
    const chunkSlice = chunks.slice(i, i + QDRANT_BATCH_SIZE);
    const vectorSlice = embeddings.slice(i, i + QDRANT_BATCH_SIZE);

    const points = chunkSlice.map((chunk, idx) => ({
      id: chunk.chunk_id,
      vector: vectorSlice[idx],
      payload: {
        source_file: chunk.source_file,
        heading: chunk.heading,
        section_number: chunk.section_number,
        content: chunk.content,
      },
    }));

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });
  }

  // Atomic database update in PostgreSQL committed only after Qdrant confirms upsert
  let insertedId = 0;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM documents WHERE source_file = ${sourceFile}`;

    const [insertedDoc] = await tx<[{ id: number }]>`
      INSERT INTO documents (source_file, file_type, file_hash, section_count, chunk_count, ingested_at)
      VALUES (${sourceFile}, ${ext.slice(1)}, ${fileHash}, ${sections.length}, ${chunks.length}, NOW())
      RETURNING id
    `;
    insertedId = insertedDoc.id;

    const PG_BATCH_SIZE = 250;
    for (let i = 0; i < chunks.length; i += PG_BATCH_SIZE) {
      const slice = chunks.slice(i, i + PG_BATCH_SIZE);
      const rows = slice.map((c) => ({
        chunk_id: c.chunk_id,
        document_id: insertedDoc.id,
        section_number: c.section_number,
        heading: c.heading,
        content: c.content,
      }));
      await tx`INSERT INTO chunks ${tx(rows)}`;
    }
  });

  console.log(`[DONE] ${sourceFile}: Successfully indexed ${chunks.length} chunks.`);
  return {
    skipped: false,
    documentId: insertedId,
    sourceFile,
    fileType: ext.slice(1),
    sectionCount: sections.length,
    chunkCount: chunks.length,
  };
}

export async function ingestCorpus(options: IngestOptions = {}) {
  const docsDir = options.docsDir || path.resolve("data/docs");
  const force = options.force ?? process.argv.includes("--force") ?? process.argv.includes("-f");

  console.log(`Starting document ingestion (docsDir: ${docsDir}, force: ${force})...`);

  // Initialize backing stores
  await initPostgres();
  await initQdrant();

  // Scan top-level entries, ignoring subdirectories
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const docFiles = entries
    .filter((e) => e.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(docsDir, e.name));

  console.log(`Discovered ${docFiles.length} candidate document(s).`);

  let ingestedCount = 0;
  let skippedCount = 0;

  for (const filePath of docFiles) {
    const res = await ingestFile(filePath, force);
    if (res.skipped) {
      skippedCount++;
    } else {
      ingestedCount++;
    }
  }

  console.log(`Ingestion completed: ${ingestedCount} indexed, ${skippedCount} skipped.`);
  return { ingestedCount, skippedCount };
}

// CLI entrypoint
if (import.meta.main) {
  ingestCorpus()
    .then(async () => {
      await sql.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Ingestion failed:", err);
      await sql.end();
      process.exit(1);
    });
}
