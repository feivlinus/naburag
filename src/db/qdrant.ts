import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config";

export const qdrant = new QdrantClient({
  url: config.QDRANT_URL,
});

export const COLLECTION_NAME = "docs";

export async function initQdrant() {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1024,
        distance: "Cosine",
      },
    });
  }

  // Ensure source_file payload index exists for efficient filtering and deletion
  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "source_file",
      field_schema: "keyword",
    });
  } catch (err: any) {
    // Ignore error if index already exists
    const msg = String(err?.message || err);
    if (!msg.includes("already exists")) {
      console.warn("Payload index creation note:", msg);
    }
  }
}
