import type { ChunkPayload, RawSection } from "../types";

// RFC 4122 URL namespace UUID as fixed base
const NAMESPACE_UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

/**
 * Generate a deterministic RFC 4122 UUIDv5 from a string key using Bun.CryptoHasher("sha1").
 */
export function generateUuidV5(name: string, namespace = NAMESPACE_UUID): string {
  const nsClean = namespace.replace(/-/g, "");
  const nsBuffer = Buffer.from(nsClean, "hex");
  const nameBuffer = Buffer.from(name, "utf-8");

  const hasher = new Bun.CryptoHasher("sha1");
  hasher.update(nsBuffer);
  hasher.update(nameBuffer);
  const hash = hasher.digest();

  // Set version to 5 (0x50) in octet 6
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122 (0x80) in octet 8
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = Buffer.from(hash.subarray(0, 16)).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Split text into chunks of ~targetSize (default: 800) characters
 * with ~overlap (default: 120) characters on word boundaries.
 */
export function splitTextIntoChunks(
  text: string,
  targetSize = 800,
  overlap = 120,
): string[] {
  const cleanText = text.replace(/\r\n/g, "\n").trim();
  if (cleanText.length <= targetSize) {
    return [cleanText];
  }

  const chunks: string[] = [];
  let start = 0;
  const len = cleanText.length;

  while (start < len) {
    let end = Math.min(start + targetSize, len);

    if (end < len) {
      // Find a natural split point before or at 'end'
      // Prefer paragraph break, then sentence break, then whitespace
      const searchRegion = cleanText.slice(Math.max(start, end - 150), Math.min(len, end + 50));
      const regionOffset = Math.max(start, end - 150);

      const paraMatch = searchRegion.lastIndexOf("\n\n");
      const sentenceMatch = searchRegion.search(/([.?!]\s)[^.?!]*$/);
      const spaceMatch = searchRegion.lastIndexOf(" ");

      let sentenceBreakPos = -1;
      if (sentenceMatch !== -1 && regionOffset + sentenceMatch > start) {
        const punctIndex = regionOffset + sentenceMatch;
        const punctChar = cleanText[punctIndex];
        if (punctChar === "?" || punctChar === "!") {
          sentenceBreakPos = punctIndex + 2;
        } else if (punctChar === ".") {
          // Check preceding word to avoid splitting on common German/English abbreviations or digits
          const beforePunct = cleanText.slice(Math.max(0, punctIndex - 12), punctIndex);
          const lastWord = beforePunct.split(/\s+/).pop()?.toLowerCase() || "";
          const isAbbreviation = /^(art|abs|nr|dr|prof|bzw|ca|vgl|bspw|etc|b|z|d\.h|e\.g|i\.e|vs|\d+)$/i.test(lastWord);
          if (!isAbbreviation) {
            sentenceBreakPos = punctIndex + 2;
          }
        }
      }

      if (paraMatch !== -1 && regionOffset + paraMatch > start) {
        end = regionOffset + paraMatch + 2;
      } else if (sentenceBreakPos !== -1) {
        end = sentenceBreakPos;
      } else if (spaceMatch !== -1 && regionOffset + spaceMatch > start) {
        end = regionOffset + spaceMatch + 1;
      }
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= len) {
      break;
    }

    // Determine next start with overlap
    let nextStart = Math.max(start + 1, end - overlap);
    // Align nextStart to word boundary so we don't start mid-word
    if (nextStart < len && cleanText[nextStart] !== " " && cleanText[nextStart] !== "\n") {
      const nextSpace = cleanText.indexOf(" ", nextStart);
      if (nextSpace !== -1 && nextSpace < end) {
        nextStart = nextSpace + 1;
      }
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Convert an array of RawSection into ChunkPayload[] with deterministic UUIDv5 IDs.
 */
export function chunkSections(
  sections: RawSection[],
  targetSize = 800,
  overlap = 120,
): ChunkPayload[] {
  const result: ChunkPayload[] = [];

  for (const section of sections) {
    const textChunks = splitTextIntoChunks(section.text, targetSize, overlap);

    textChunks.forEach((content, idx) => {
      const chunkIndex = idx + 1;
      const key = `${section.source_file}:s${section.section_number}:c${chunkIndex}`;
      const chunk_id = generateUuidV5(key);

      result.push({
        chunk_id,
        source_file: section.source_file,
        heading: section.heading,
        section_number: section.section_number,
        content,
      });
    });
  }

  return result;
}
