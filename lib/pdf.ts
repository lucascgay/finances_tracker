export interface PdfText {
  text: string;
  pages: number;
}

/**
 * Extract raw text from a PDF buffer using the classic pdf-parse v1 engine.
 *
 * pdf-parse bundles pdfjs-dist, which Next.js's bundler can't pre-compile
 * cleanly (it throws at import time and can 500 the whole route). Loading it
 * lazily via dynamic import() confines any PDF concern to this function so the
 * paste/text path can never crash /api/extract.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  // Import the real extractor directly. The package's top-level `index.js`
  // wraps it in a "debug mode" block that reads a missing test fixture when
  // `module.parent` is falsy under a bundler (throwing ENOENT). Bypassing it
  // also keeps pdfjs out of the eager module graph so paste/text can't 500.
  const { default: pdf } = await import("pdf-parse/lib/pdf-parse.js");
  const result = await pdf(buffer, { version: "v1.10.100" });
  return {
    text: (result.text ?? "").replace(/\u0000/g, ""),
    pages: result.numpages ?? 1,
  };
}
