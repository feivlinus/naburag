import { describe, it, expect } from "bun:test";
import { generateUuidV5, splitTextIntoChunks, chunkSections } from "../src/ingest/chunker";
import type { RawSection } from "../src/types";

describe("Deterministic Chunker", () => {
  it("generates deterministic RFC 4122 UUIDv5 strings", () => {
    const key = "DSVGO.pdf:s1:c1";
    const uuid1 = generateUuidV5(key);
    const uuid2 = generateUuidV5(key);

    expect(uuid1).toBe(uuid2);

    // RFC 4122 UUID regex with version 5 (char at pos 14 is '5') and variant (char at pos 19 is 8, 9, a, or b)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(uuid1)).toBe(true);

    const differentKey = "DSVGO.pdf:s1:c2";
    const uuidDifferent = generateUuidV5(differentKey);
    expect(uuidDifferent).not.toBe(uuid1);
  });

  it("splits text without cutting words mid-token and creates overlap", () => {
    const words: string[] = [];
    for (let i = 0; i < 200; i++) {
      words.push(`Word${i}`);
    }
    const longText = words.join(" ");

    const chunks = splitTextIntoChunks(longText, 400, 80);
    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      // Ensure each token in chunk is a full "Word<N>"
      const chunkWords = chunk.split(/\s+/);
      for (const w of chunkWords) {
        expect(w).toMatch(/^Word\d+$/);
      }
    }

    // Check overlap between chunk 0 and chunk 1
    const lastWordChunk0 = chunks[0].split(/\s+/).pop();
    expect(chunks[1]).toContain(lastWordChunk0!);
  });

  it("avoids splitting chunks mid-sentence on legal abbreviations", () => {
    // Fill text up to near split limit, then place abbreviation
    const prefix = "Dies ist ein wichtiger juristischer Text über Datenschutz. ".repeat(6);
    const middle = "Die Verarbeitung erfolgt gemäß Art. 6 Abs. 1 lit. a DSGVO ohne Unterbrechung. ";
    const suffix = "Danach folgt weiterer erläuternder Text für das Verfahren. ".repeat(6);
    const fullText = prefix + middle + suffix;

    const chunks = splitTextIntoChunks(fullText, 450, 60);
    expect(chunks.length).toBeGreaterThan(1);
    // Ensure no chunk ends abruptly with "Art." or "Abs."
    for (const chunk of chunks) {
      expect(chunk.endsWith("Art.")).toBe(false);
      expect(chunk.endsWith("Abs.")).toBe(false);
    }
  });

  it("chunks RawSection array into ChunkPayload items with correct metadata", () => {
    const sections: RawSection[] = [
      {
        source_file: "test.md",
        section_number: 1,
        heading: "Introduction",
        text: "Short text under 800 chars.",
      },
      {
        source_file: "test.md",
        section_number: 2,
        heading: "Body",
        text: "Paragraph one with repeated text. ".repeat(40),
      },
    ];

    const payloads = chunkSections(sections, 400, 60);
    expect(payloads.length).toBeGreaterThan(2);

    expect(payloads[0].source_file).toBe("test.md");
    expect(payloads[0].heading).toBe("Introduction");
    expect(payloads[0].section_number).toBe(1);
    expect(payloads[0].content).toBe("Short text under 800 chars.");

    expect(payloads[1].source_file).toBe("test.md");
    expect(payloads[1].heading).toBe("Body");
    expect(payloads[1].section_number).toBe(2);
  });
});
