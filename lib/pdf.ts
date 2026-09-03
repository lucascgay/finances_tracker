import { spawnSync } from "node:child_process";
import path from "node:path";

export interface PdfText {
  text: string;
  pages: number;
}

interface ExtractResult {
  text?: string;
  pages?: number;
  error?: string;
}

function projectRoot(): string {
  return process.cwd();
}

function pythonBin(): string {
  // Allow an explicit override for the Python interpreter.
  if (process.env.PDF_PYTHON) return process.env.PDF_PYTHON;
  const venvPython = path.join(
    projectRoot(),
    "py",
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
  );
  return venvPython;
}

/**
 * Extract text from a PDF buffer using a layout-aware python script backed by
 * pdfplumber. The script reads the PDF from stdin and writes JSON to stdout.
 *
 * pdf-parse (v1) produced a jumbled, non-layout text blob for multi-column bank
 * statements; pdfplumber's layout mode reconstructs rows in reading order so
 * the LLM sees clean, linear transaction lines.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const script = path.join(projectRoot(), "scripts", "pdf_extract.py");
  const python = pythonBin();

  const res = spawnSync(python, [script], {
    input: buffer,
    maxBuffer: 50 * 1024 * 1024,
    encoding: "utf8",
    timeout: 30_000,
  });

  if (res.error || res.status !== 0) {
    const detail = (res.stderr ?? "").trim() || (res.error?.message ?? "unknown error");
    throw new Error(
      `PDF text extraction failed. Is pdfplumber installed? Run \`uv sync\` in the ` +
        `"py" directory (${path.join(projectRoot(), "py")}) first. Details: ${detail}`
    );
  }

  let data: ExtractResult;
  try {
    data = JSON.parse(res.stdout) as ExtractResult;
  } catch {
    throw new Error("PDF text extraction returned an invalid result.");
  }

  if (data.error) {
    throw new Error(`PDF text extraction failed: ${data.error}`);
  }

  return {
    text: (data.text ?? "").replace(/\u0000/g, ""),
    pages: data.pages ?? 1,
  };
}
