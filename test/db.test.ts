import { describe, it, expect, afterAll } from "bun:test";
import { initPostgres, sql } from "../src/db/postgres";
import { initQdrant, qdrant, COLLECTION_NAME } from "../src/db/qdrant";

describe("Database & Vector Store Initialization", () => {

  it("should initialize postgres tables idempotently", async () => {
    await initPostgres();

    // Verify tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('documents', 'chunks', 'eval_results');
    `;
    const names = tables.map((t) => t.table_name);
    expect(names).toContain("documents");
    expect(names).toContain("chunks");
    expect(names).toContain("eval_results");

    // Re-run to ensure idempotency
    await initPostgres();
  });

  it("should initialize qdrant collection and payload index idempotently", async () => {
    await initQdrant();

    const info = await qdrant.getCollection(COLLECTION_NAME);
    expect(info.status).toBe("green");
    expect(info.config.params.vectors).toBeDefined();

    // Re-run to ensure idempotency
    await initQdrant();
  });
});
