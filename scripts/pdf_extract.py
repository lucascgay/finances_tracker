#!/usr/bin/env python3
"""Layout-aware PDF text extraction using pdfplumber.

Reads a PDF from stdin and writes a JSON object to stdout:

    {"text": "<extracted text>", "pages": 2}

The text is reconstructed from character positions so multi-column bank /
credit-card statements come out in reading order instead of as a jumbled blob.
"""

import json
import sys
import tempfile
import os


def extract(buffer: bytes) -> dict:
    fd, path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(buffer)

        import pdfplumber

        pages_text: list[str] = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                # layout=True reorders words by (x, y) position so columns and
                # line breaks survive. Fall back to default text if that yields
                # nothing.
                page_text = page.extract_text(layout=True) or page.extract_text()
                if page_text:
                    pages_text.append(page_text)

        text = "\n\n".join(pages_text)
        # Trim the per-line leading whitespace that pdfplumber's layout mode
        # adds so we don't waste LLM tokens, and drop fully-blank lines.
        text = "\n".join(
            line.strip()
            for line in text.splitlines()
            if line.strip()
        )
        return {"text": text, "pages": len(pages_text)}
    finally:
        os.unlink(path)


def main() -> None:
    buffer = sys.stdin.buffer.read()
    if not buffer:
        sys.stdout.write(json.dumps({"text": "", "pages": 0}))
        return
    try:
        result = extract(buffer)
        sys.stdout.write(json.dumps(result))
    except Exception as exc:  # noqa: BLE001 - surface any parse issue to caller
        sys.stdout.write(json.dumps({"error": str(exc)}))


if __name__ == "__main__":
    main()
