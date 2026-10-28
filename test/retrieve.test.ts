import { describe, it, expect } from "bun:test";
import { qdrant } from "../src/db/qdrant";
import { retrieve, RagAnswerSchema } from "../src/retrieval/retrieve";

describe("Deterministic Retrieval Pipeline", () => {
  it("validates RagAnswerSchema structure for grounded and abstained answers", () => {
    const grounded = {
      abstained: false,
      answer: "The EU AI Act classifies AI systems based on risk.",
      citations: [
        {
          source_file: "legal_memo.md",
          heading: "## Risk Categories",
          section_number: 2,
          quote_or_reason: "AI systems are categorized into unacceptable, high, and low risk.",
        },
      ],
    };

    const parsedGrounded = RagAnswerSchema.parse(grounded);
    expect(parsedGrounded.abstained).toBe(false);
    expect(parsedGrounded.citations.length).toBe(1);

    const abstained = {
      abstained: true,
      answer: "I don't know based on the provided documents.",
      citations: [],
    };

    const parsedAbstained = RagAnswerSchema.parse(abstained);
    expect(parsedAbstained.abstained).toBe(true);
    expect(parsedAbstained.citations.length).toBe(0);
  });

  it("executes retrieval, formats context, and generates grounded answer with citations", async () => {
    const originalFetch = globalThis.fetch;
    const originalQuery = qdrant.query;

    let capturedSystemPrompt = "";
    let capturedUserPrompt = "";
    let capturedFilter: any = null;

    // Mock Qdrant query
    qdrant.query = (async (collection: string, params: any) => {
      capturedFilter = params.filter;
      return {
        points: [
          {
            id: "chunk-uuid-1",
            score: 0.895,
            payload: {
              source_file: "legal_memo.md",
              heading: "## Compliance Requirements",
              section_number: 1,
              content: "High-risk AI systems must implement risk management systems.",
            },
          },
          {
            id: "chunk-uuid-2",
            score: 0.812,
            payload: {
              source_file: "legal_memo.md",
              heading: "## Governance",
              section_number: 2,
              content: "Quality management and logging are mandatory.",
            },
          },
        ],
      } as any;
    }) as any;

    // Mock fetch for embeddings and chat completions
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/embed")) {
        return new Response(
          JSON.stringify({ embeddings: [new Array(1024).fill(0.05)] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/v1/chat/completions")) {
        const body = JSON.parse(init?.body as string);
        capturedSystemPrompt = body.messages[0].content;
        capturedUserPrompt = body.messages[1].content;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    abstained: false,
                    answer: "High-risk AI systems require risk management and quality logging.",
                    citations: [
                      {
                        source_file: "legal_memo.md",
                        heading: "## Compliance Requirements",
                        section_number: 1,
                        quote_or_reason: "High-risk AI systems must implement risk management systems.",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const res = await retrieve("What are the requirements for high-risk AI?", {
        source_file: "legal_memo.md",
      });

      expect(res.abstained).toBe(false);
      expect(res.answer).toContain("High-risk AI systems");
      expect(res.citations.length).toBe(1);
      expect(res.citations[0].source_file).toBe("legal_memo.md");
      expect(res.retrieved_chunks.length).toBe(2);
      expect(res.retrieved_chunks[0].score).toBe(0.895);
      expect(res.retrieved_chunks[0].chunk_id).toBe("chunk-uuid-1");

      // Verify filter passed to Qdrant
      expect(capturedFilter).toEqual({
        must: [{ key: "source_file", match: { value: "legal_memo.md" } }],
      });

      // Verify context block formatting in user prompt
      expect(capturedUserPrompt).toContain("[1] Source: legal_memo.md (## Compliance Requirements, Page/Section 1)");
      expect(capturedUserPrompt).toContain("Question: What are the requirements for high-risk AI?");
      expect(capturedSystemPrompt).toContain("strict, factual");
    } finally {
      globalThis.fetch = originalFetch;
      qdrant.query = originalQuery;
    }
  });

  it("immediately abstains without calling LLM if no matching chunks found", async () => {
    const originalFetch = globalThis.fetch;
    const originalQuery = qdrant.query;

    let llmCalled = false;

    qdrant.query = (async () => {
      return { points: [] } as any;
    }) as any;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/embed")) {
        return new Response(
          JSON.stringify({ embeddings: [new Array(1024).fill(0.01)] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/v1/chat/completions")) {
        llmCalled = true;
        return new Response("{}", { status: 500 });
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const res = await retrieve("Unanswerable question with no vector hits");
      expect(res.abstained).toBe(true);
      expect(res.answer).toBe("I don't know based on the provided documents.");
      expect(res.citations).toEqual([]);
      expect(res.retrieved_chunks).toEqual([]);
      expect(llmCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      qdrant.query = originalQuery;
    }
  });
});
