import { z } from "zod";
import { qdrant } from "../db/qdrant";
import { embedTexts, generateStructured } from "../llm";
import type { RetrievedChunk, RagResponse } from "../types";

export const CitationSchema = z.object({
  source_file: z.string().describe("Source document filename"),
  heading: z.string().describe("Heading or page title of the section"),
  section_number: z.number().describe("1-based page or section number"),
  quote_or_reason: z.string().describe("Direct quote from the context or explanation supporting this citation"),
});

export const RagAnswerSchema = z.object({
  abstained: z.boolean().describe("True if the provided context does not contain enough information to answer"),
  answer: z.string().describe("Factual answer based strictly on context, or 'I don't know based on the provided documents.'"),
  citations: z.array(CitationSchema).describe("List of exact citations supporting the answer"),
});

export interface RetrieveOptions {
  source_file?: string;
  limit?: number;
}

export async function retrieve(
  question: string,
  options?: RetrieveOptions
): Promise<RagResponse> {
  const startTime = Date.now();
  const limit = Math.max(1, options?.limit ?? 5);

  // 1. Generate dense query embedding
  const embeddings = await embedTexts([question]);
  const queryVector = embeddings[0];
  if (!queryVector || queryVector.length === 0) {
    throw new Error("Failed to generate embedding for question");
  }

  // 2. Query Qdrant
  const filter = options?.source_file
    ? {
        must: [
          {
            key: "source_file",
            match: { value: options.source_file },
          },
        ],
      }
    : undefined;

  const searchResults = await qdrant.query("docs", {
    query: queryVector,
    limit,
    with_payload: true,
    filter,
  });

  const retrieved_chunks: RetrievedChunk[] = searchResults.points.map((point) => {
    const payload = (point.payload || {}) as Record<string, unknown>;
    return {
      chunk_id: String(point.id),
      source_file: typeof payload.source_file === "string" ? payload.source_file : "",
      heading: typeof payload.heading === "string" ? payload.heading : "",
      section_number: Number(payload.section_number ?? 0),
      content: typeof payload.content === "string" ? payload.content : "",
      score: point.score ?? 0,
    };
  });

  // 3. If no chunks found, abstain immediately
  if (retrieved_chunks.length === 0) {
    return {
      abstained: true,
      answer: "I don't know based on the provided documents.",
      citations: [],
      retrieved_chunks: [],
      latency_ms: Date.now() - startTime,
    };
  }

  // 4. Construct context blocks
  const contextBlocks = retrieved_chunks
    .map(
      (chunk, idx) =>
        `[${idx + 1}] Source: ${chunk.source_file} (${chunk.heading}, Page/Section ${chunk.section_number})\n${chunk.content}`
    )
    .join("\n\n");

  const systemPrompt = `You are a strict, factual Retrieval-Augmented Generation assistant.
Answer the user's question using ONLY the provided numbered context blocks.
Rules:
1. If the provided context does NOT contain sufficient factual information to answer the question, set "abstained": true, "answer": "I don't know based on the provided documents.", and "citations": [].
2. If the context contains the answer, set "abstained": false, provide a direct, concise, factual answer, and include exact citations for each fact.
3. Every citation must accurately reference the source_file, heading, section_number, and include a direct quote or specific reason from the matching context block.
4. Do NOT hallucinate, extrapolate, or use external knowledge not present in the context.`;

  const userPrompt = `Context blocks:
${contextBlocks}

Question: ${question}`;

  const ragAnswer = await generateStructured(systemPrompt, userPrompt, RagAnswerSchema);

  return {
    ...ragAnswer,
    retrieved_chunks,
    latency_ms: Date.now() - startTime,
  };
}
