import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { embedTexts, generateStructured } from "../src/llm";

describe("LLM Client", () => {
  it("batches text embeddings and parses 1024-dimensional vectors", async () => {
    const originalFetch = globalThis.fetch;
    const recordedBatches: string[][] = [];

    // Mock fetch for Ollama /api/embed
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/embed")) {
        const body = JSON.parse(init?.body as string);
        recordedBatches.push(body.input);
        const embeddings = body.input.map(() => new Array(1024).fill(0.123));
        return new Response(JSON.stringify({ embeddings }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const inputs = ["Doc 1", "Doc 2", "Doc 3", "Doc 4", "Doc 5"];
      const results = await embedTexts(inputs, 2);

      expect(recordedBatches.length).toBe(3); // 2 + 2 + 1
      expect(recordedBatches[0]).toEqual(["Doc 1", "Doc 2"]);
      expect(recordedBatches[1]).toEqual(["Doc 3", "Doc 4"]);
      expect(recordedBatches[2]).toEqual(["Doc 5"]);

      expect(results.length).toBe(5);
      expect(results[0].length).toBe(1024);
      expect(results[4].length).toBe(1024);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles structured generation with Zod validation", async () => {
    const originalFetch = globalThis.fetch;
    let capturedPayload: any = null;

    const TestSchema = z.object({
      name: z.string(),
      score: z.number(),
    });

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/v1/chat/completions")) {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ name: "EU-AI-Act", score: 98 }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const result = await generateStructured("System Prompt", "User Prompt", TestSchema);
      expect(result.name).toBe("EU-AI-Act");
      expect(result.score).toBe(98);

      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.response_format.type).toBe("json_schema");
      expect(capturedPayload.response_format.json_schema.schema).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
