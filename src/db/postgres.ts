import postgres from "postgres";
import { config } from "../config";

export const sql = postgres({
  host: config.POSTGRES_HOST,
  port: config.POSTGRES_PORT,
  database: config.POSTGRES_DB,
  username: config.POSTGRES_USER,
  password: config.POSTGRES_PASSWORD,
  max: 10,
});

export async function initPostgres() {
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      source_file TEXT UNIQUE NOT NULL,
      file_type TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      section_count INT NOT NULL,
      chunk_count INT NOT NULL,
      ingested_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chunks (
      chunk_id UUID PRIMARY KEY,
      document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      section_number INT NOT NULL,
      heading TEXT NOT NULL,
      content TEXT NOT NULL
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(document_id);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS eval_results (
      id SERIAL PRIMARY KEY,
      run_id UUID NOT NULL,
      run_at TIMESTAMPTZ DEFAULT NOW(),
      question TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      abstained BOOLEAN NOT NULL,
      retrieval_hit BOOLEAN NOT NULL,
      cited_sources JSONB NOT NULL,
      answer TEXT NOT NULL
    );
  `;
}
