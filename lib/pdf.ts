export interface PdfText {
  text: string;
  pages: number;
}

interface Token {
  str: string;
  x: number;
  y: number;
  width: number;
}

// Minimal structural types for the pdfjs-dist API surface we use. Using our
// own structural types (instead of pdfjs's .d.ts paths) keeps this importable
// under both Next.js and plain tsx regardless of the installed version.
interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string; transform: number[]; width?: number }> }>;
  cleanup(): void;
}

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface LoadingTask {
  promise: Promise<PdfDocument>;
  destroy(): void;
}

type GetDocumentFn = (params: object) => LoadingTask;

/**
 * Reconstruct reading-order, layout-aware text from a page's text items.
 *
 * pdf-parse collapses everything into one jumbled blob, which makes the LLM
 * unable to tell transactions apart. Here we cluster text by vertical (y)
 * position into "lines", sort within each line by horizontal (x) position, and
 * keep column gaps so multi-column bank / credit-card statements stay readable.
 */
async function extractPageText(page: PdfPage): Promise<string> {
  const content = await page.getTextContent();

  const tokens: Token[] = [];
  for (const item of content.items) {
    const str = item.str?.trim();
    if (!str) continue;
    const tr = item.transform;
    tokens.push({
      str,
      x: tr[4],
      y: tr[5],
      width: item.width ?? str.length,
    });
  }

  // Group tokens into lines by vertical position (tolerance small enough to
  // keep one logical row, large enough to survive minor baseline jitter).
  // pdfjs yields y in PDF user space (origin bottom-left, y grows upward), so
  // sort DESCENDING by y for top-to-bottom reading order.
  tokens.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Token[][] = [];
  for (const t of tokens) {
    const last = rows[rows.length - 1];
    const rowY = last ? last[0].y : null;
    if (rowY !== null && Math.abs(t.y - rowY) <= 2) last.push(t);
    else rows.push([t]);
  }

  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd = 0;
    for (const { str, x, width } of row) {
      const gap = x - prevEnd;
      // Large horizontal gaps = column boundaries. Preserve them as extra
      // spacing so "$42.10" stays visually apart from the description.
      const sep = gap > 1 ? " ".repeat(Math.max(2, Math.min(8, Math.round(gap)))) : " ";
      line += line ? sep + str : str;
      prevEnd = x + width;
    }
    if (line.trim()) lines.push(line.trim());
  }

  return lines.join("\n");
}

/**
 * Extract layout-aware text from a PDF buffer using pdfjs-dist directly.
 *
 * pdfjs-dist is loaded lazily via dynamic import() so it stays out of the
 * paste/text bundle path, and it is small enough to avoid bundler issues.
 * Running in Node, pdfjs uses its built-in "fake worker", so no Worker setup
 * is required.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const mod = (await import("pdfjs-dist/legacy/build/pdf.js")) as {
    getDocument?: GetDocumentFn;
    default?: { getDocument?: GetDocumentFn };
  };

  // The legacy build is CommonJS; under dynamic import() its exports can
  // surface either as named exports or nested under `default`.
  const getDocument = mod.getDocument ?? mod.default?.getDocument;
  if (typeof getDocument !== "function") {
    throw new Error("pdfjs-dist did not load correctly.");
  }

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }) as LoadingTask;

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      try {
        const text = await extractPageText(page);
        if (text.trim()) pages.push(text.trim());
      } finally {
        page.cleanup();
      }
    }
    await pdf.destroy();
    return { text: pages.join("\n\n"), pages: pages.length };
  } catch (err) {
    loadingTask.destroy();
    throw err;
  }
}
