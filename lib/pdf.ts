import { extractText } from "unpdf";

export interface PdfText {
  text: string;
  pages: number;
}

/**
 * Extract raw text from a PDF buffer using `unpdf`.
 *
 * `unpdf` wraps pdfjs-dist and ships a tree-shakable ESM/CJS build that works
 * out of the box in Node — no `canvas` binary, no worker plumbing, and no
 * webpack `externals` hacks (unlike `pdf-parse` / a raw `pdfjs-dist` import,
 * both of which have historically broken Next.js server bundling).
 *
 * `extractText` preserves per-line reading order (description + amount kept
 * together), which matters a lot for an LLM parsing columnar statements.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const { text, totalPages } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });

  return {
    // Null bytes sometimes leak through from encoded content streams.
    text: (text ?? "").replace(/\u0000/g, ""),
    pages: totalPages ?? 1,
  };
}
