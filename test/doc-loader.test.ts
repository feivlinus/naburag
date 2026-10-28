import { describe, it, expect } from "bun:test";
import { loadDocument } from "../src/ingest/doc-loader";

describe("Document Loader", () => {
  it("loads PDF document and preserves page structure", async () => {
    const sections = await loadDocument("data/docs/DSVGO.pdf");
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].source_file).toBe("DSVGO.pdf");
    expect(sections[0].heading).toBe("Page 1");
    expect(sections[0].text.length).toBeGreaterThan(0);
  });

  it("loads Markdown document and splits on headings", async () => {
    const sections = await loadDocument("data/docs/legal_memo_eu_ai_act_compliance_mandant.md");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].source_file).toBe("legal_memo_eu_ai_act_compliance_mandant.md");
    expect(sections.some((s) => s.heading.includes("Executive Summary"))).toBe(true);
  });

  it("loads plain text document and splits into sections", async () => {
    const sections = await loadDocument("data/docs/Die_Verwandlung_Kafka.txt");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].source_file).toBe("Die_Verwandlung_Kafka.txt");
    expect(sections[0].heading).toBe("Section 1");
  });

  it("loads DOCX document and splits into sections", async () => {
    const sections = await loadDocument("data/docs/EVB_IT_Dienstleistung_Langfassung.docx");
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].source_file).toBe("EVB_IT_Dienstleistung_Langfassung.docx");
    expect(sections[0].text.length).toBeGreaterThan(0);
  });

  it("loads HTML/HTM document, strips tags, and extracts headings", async () => {
    const sections = await loadDocument("data/docs/BSI_-_IT-Grundschutz.htm");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].source_file).toBe("BSI_-_IT-Grundschutz.htm");
    expect(sections.some((s) => s.heading.includes("IT-Grundschutz"))).toBe(true);
  });

  it("preserves code block comments without splitting markdown sections", async () => {
    const tempFile = "/tmp/test-code-blocks.md";
    const content = `# Section 1
Here is text.

\`\`\`python
# This is a python comment
def hello():
    # Another comment
    return "world"
\`\`\`

## Section 2
Final text.
`;
    await Bun.write(tempFile, content);

    const sections = await loadDocument(tempFile);
    expect(sections.length).toBe(2);
    expect(sections[0].heading).toBe("Section 1");
    expect(sections[0].text).toContain("# This is a python comment");
    expect(sections[1].heading).toBe("Section 2");
  });

  it("captures HTML content preceding the first heading as an overview section", async () => {
    const tempFile = "/tmp/test-intro.html";
    const content = `<html><body>
      <p>This is the important introductory summary before any heading appears.</p>
      <h1>First Heading</h1>
      <p>Section 1 body text.</p>
    </body></html>`;
    await Bun.write(tempFile, content);

    const sections = await loadDocument(tempFile);
    expect(sections.length).toBe(2);
    expect(sections[0].heading).toBe("Overview");
    expect(sections[0].text).toContain("introductory summary");
    expect(sections[1].heading).toBe("First Heading");
  });

  it("loads JSON document and extracts records/arrays with headings", async () => {
    const sections = await loadDocument("data/docs/secops_tickets-cve_feed.json");
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].source_file).toBe("secops_tickets-cve_feed.json");
    expect(sections.some((s) => s.heading.includes("CVE-2026-38911"))).toBe(true);
    expect(sections.some((s) => s.heading.includes("INC-2026-90412"))).toBe(true);
  });
});
