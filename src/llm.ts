import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { config } from "./config";

/**
 * Batched embedding generation via Ollama /api/embed.
 * Defaults to 1024-dimensional embeddings (e.g. bge-m3).
 */
export async function embedTexts(texts: string[], batchSize = 64): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch(`${config.OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Embedding failed [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as { embeddings: number[][] };
    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new Error(`Unexpected embedding response format: ${JSON.stringify(data)}`);
    }

    allEmbeddings.push(...data.embeddings);
  }

  return allEmbeddings;
}

/**
 * Structured LLM generation calling /v1/chat/completions with JSON Schema validation via Zod.
 */
export async function generateStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonSchema = zodToJsonSchema(schema, { target: "openAi" });

  const payload: any = {
    model: config.LLM_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: true,
        schema: jsonSchema,
      },
    },
  };

  const res = await fetch(`${config.LLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Structured LLM generation failed [${res.status}]: ${errText}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content received from LLM response");
  }

  const parsed = JSON.parse(content);
  return schema.parse(parsed);
}
