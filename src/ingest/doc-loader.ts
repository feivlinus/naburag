import path from "node:path";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { RawSection } from "../types";

/**
 * Split plain text into ~3000 character sections on paragraph boundaries.
 */
function splitTextIntoSections(sourceFile: string, text: string, targetSize = 3000): RawSection[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n\s*\n/);
  const sections: RawSection[] = [];

  let currentChunk: string[] = [];
  let currentLen = 0;
  let sectionIndex = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentLen + trimmed.length > targetSize && currentChunk.length > 0) {
      sections.push({
        source_file: sourceFile,
        section_number: sectionIndex,
        heading: `Section ${sectionIndex}`,
        text: currentChunk.join("\n\n"),
      });
      sectionIndex++;
      currentChunk = [];
      currentLen = 0;
    }

    currentChunk.push(trimmed);
    currentLen += trimmed.length;
  }

  if (currentChunk.length > 0) {
    sections.push({
      source_file: sourceFile,
      section_number: sectionIndex,
      heading: `Section ${sectionIndex}`,
      text: currentChunk.join("\n\n"),
    });
  }

  return sections;
}

/**
 * Parse Markdown documents into sections by heading (#, ##, ###).
 */
function parseMarkdownSections(sourceFile: string, content: string): RawSection[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const sections: RawSection[] = [];

  let currentHeading = "Introduction";
  let currentLines: string[] = [];
  let sectionNumber = 1;
  let inCodeFence = false;

  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inCodeFence = !inCodeFence;
    }

    const headingMatch = !inCodeFence ? line.match(/^(#{1,3})\s+(.+)$/) : null;
    if (headingMatch) {
      const text = currentLines.join("\n").trim();
      if (text) {
        sections.push({
          source_file: sourceFile,
          section_number: sectionNumber++,
          heading: currentHeading,
          text,
        });
        currentLines = [];
      }
      currentHeading = headingMatch[2].trim();
    } else {
      currentLines.push(line);
    }
  }

  const remaining = currentLines.join("\n").trim();
  if (remaining) {
    sections.push({
      source_file: sourceFile,
      section_number: sectionNumber++,
      heading: currentHeading,
      text: remaining,
    });
  }

  return sections;
}

/**
 * Parse HTML/HTM documents into sections by stripping markup and splitting on h1-h3.
 */
function parseHtmlSections(sourceFile: string, html: string): RawSection[] {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg").remove();

  const sections: RawSection[] = [];
  const headings = $("h1, h2, h3").toArray();

  if (headings.length === 0) {
    const text = $("body").text().replace(/\s+/g, " ").trim();
    if (text) {
      sections.push({
        source_file: sourceFile,
        section_number: 1,
        heading: "Content",
        text,
      });
    }
    return sections;
  }

  let sectionIndex = 1;

  // Capture introductory content before the first heading if present
  const firstHeading = $(headings[0]);
  const introParts: string[] = [];
  let prevEl = firstHeading.prev();
  while (prevEl.length > 0) {
    const t = prevEl.text().trim();
    if (t) introParts.unshift(t);
    prevEl = prevEl.prev();
  }
  let p = firstHeading.parent();
  while (p.length > 0 && !p.is("body, html")) {
    let pPrev = p.prev();
    while (pPrev.length > 0) {
      const t = pPrev.text().trim();
      if (t) introParts.unshift(t);
      pPrev = pPrev.prev();
    }
    p = p.parent();
  }
  const introText = introParts.join("\n\n").trim();
  if (introText) {
    sections.push({
      source_file: sourceFile,
      section_number: sectionIndex++,
      heading: "Overview",
      text: introText,
    });
  }

  for (const headingEl of headings) {
    const headingText = $(headingEl).text().trim() || `Section ${sectionIndex}`;
    const parts: string[] = [];

    let curr = $(headingEl).next();
    while (curr.length > 0 && !curr.is("h1, h2, h3")) {
      const t = curr.text().trim();
      if (t) {
        parts.push(t);
      }
      curr = curr.next();
    }

    let sectionText = parts.join("\n\n").trim();
    if (!sectionText) {
      const parent = $(headingEl).parent();
      // Only clone if parent contains solely this heading, avoiding cloning all sibling sections
      if (parent.length > 0 && !parent.is("body, html") && parent.find("h1, h2, h3").length <= 1) {
        const clone = parent.clone();
        clone.find("h1, h2, h3").remove();
        sectionText = clone.text().replace(/\s+/g, " ").trim();
      }
    }

    if (!sectionText) {
      sectionText = headingText;
    }

    sections.push({
      source_file: sourceFile,
      section_number: sectionIndex++,
      heading: headingText,
      text: sectionText,
    });
  }

  return sections;
}

/**
 * Parse JSON documents into sections.
 */
function parseJsonSections(sourceFile: string, data: any): RawSection[] {
  const sections: RawSection[] = [];
  let sectionNumber = 1;

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const id = (item && typeof item === "object") ? (item.cve_id || item.ticket_id || item.id || item.name) : undefined;
      const heading = id ? `Record ${i + 1}: ${id}` : `Record ${i + 1}`;
      const text = typeof item === "string" ? item : JSON.stringify(item, null, 2);

      sections.push({
        source_file: sourceFile,
        section_number: sectionNumber++,
        heading,
        text,
      });
    }
  } else if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          const id = (item && typeof item === "object") ? (item.cve_id || item.ticket_id || item.id || item.name) : undefined;
          const heading = id ? `${key}: ${id}` : `${key} [${i + 1}]`;
          const text = typeof item === "string" ? item : JSON.stringify(item, null, 2);

          sections.push({
            source_file: sourceFile,
            section_number: sectionNumber++,
            heading,
            text,
          });
        }
      } else {
        const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        sections.push({
          source_file: sourceFile,
          section_number: sectionNumber++,
          heading: key,
          text,
        });
      }
    }
  }

  return sections;
}

/**
 * Load and normalize any supported document into RawSection[].
 */
export async function loadDocument(filePath: string): Promise<RawSection[]> {
  const sourceFile = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf": {
      const buf = await Bun.file(filePath).arrayBuffer();
      const { text: pages } = await extractText(new Uint8Array(buf), { mergePages: false });
      const sections: RawSection[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i]?.trim();
        if (pageText && pageText.length > 0) {
          sections.push({
            source_file: sourceFile,
            section_number: i + 1,
            heading: `Page ${i + 1}`,
            text: pageText,
          });
        }
      }
      return sections;
    }

    case ".md": {
      const content = await Bun.file(filePath).text();
      return parseMarkdownSections(sourceFile, content);
    }

    case ".txt": {
      const content = await Bun.file(filePath).text();
      return splitTextIntoSections(sourceFile, content, 3000);
    }

    case ".docx": {
      const result = await mammoth.extractRawText({ path: filePath });
      return splitTextIntoSections(sourceFile, result.value, 3000);
    }

    case ".html":
    case ".htm": {
      const content = await Bun.file(filePath).text();
      return parseHtmlSections(sourceFile, content);
    }

    case ".json": {
      const data = await Bun.file(filePath).json();
      return parseJsonSections(sourceFile, data);
    }

    default:
      throw new Error(`Unsupported document extension '${ext}' for file: ${filePath}`);
  }
}
