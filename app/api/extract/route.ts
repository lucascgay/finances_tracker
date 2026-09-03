import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/pdf";
import { extractTransactions } from "@/lib/llm";
import { normalizeTransactions, ExtractionResponseSchema } from "@/lib/extract";

export const runtime = "nodejs";

// Two modes, switch on the content type:
//   - multipart/form-data:  a dropped PDF file (field "file") + optional name
//   - application/json:     { text: "pasted lines...", name?, sourceType? }
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handlePdf(req);
    }
    return await handleText(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[extract] failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function handlePdf(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const sourceTypeRaw = form.get("sourceType")?.toString();
  const nameRaw = form.get("name")?.toString();

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text } = await extractPdfText(buffer);

  // A PDF with no (or almost no) text layer is almost certainly a scanned /
  // image-based document. pdfplumber can't OCR images, so instead of sending
  // nothing to the LLM and silently returning "parsed 0", fail clearly.
  if (!text || text.trim().length < 40) {
    return NextResponse.json(
      {
        error:
          "Could not read enough text from this PDF (it may be a scanned/image document " +
          "with no text layer). Try opening it in Preview and copying/pasting the text, " +
          "or run the PDF through an OCR tool (e.g. ocrmypdf) first.",
      },
      { status: 400 }
    );
  }

  // Source type auto-guess for PDFs: usually a credit card statement.
  const sourceType = (sourceTypeRaw as
    | "CreditCardStatement"
    | "UtilityBill"
    | "ManualPaste") ?? "CreditCardStatement";
  const name = nameRaw || (file.name || "upload.pdf");

  return persistAndRespond(text, name, sourceType);
}

async function handleText(body: {
  text?: string;
  name?: string;
  sourceType?: string;
}) {
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "No text provided to parse." }, { status: 400 });
  }
  const sourceType = (body.sourceType as
    | "CreditCardStatement"
    | "UtilityBill"
    | "ManualPaste") ?? "ManualPaste";
  const name = body.name || `Paste · ${new Date().toISOString().slice(0, 10)}`;
  return persistAndRespond(body.text, name, sourceType);
}

async function persistAndRespond(
  text: string,
  name: string,
  sourceType: "CreditCardStatement" | "UtilityBill" | "ManualPaste"
) {
  // 1) Run the LLM parser.
  const raw = await extractTransactions(text);
  const schema = ExtractionResponseSchema.parse(raw);
  const rows = normalizeTransactions(schema);

  // 2) Persist the source statement (even if zero transactions parsed).
  const statement = await prisma.statement.create({
    data: { name, sourceType, content: text },
  });

  // 3) Persist the transactions.
  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.transaction.create({
        data: {
          description: r.description,
          merchant: r.merchant,
          amount: r.amount,
          category: r.category as never,
          sourceType,
          date: r.date,
          statementId: statement.id,
        },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    sourceType,
    statementId: statement.id,
    parsed: rows.length,
    inserted: created.length,
    transactions: created,
  });
}
