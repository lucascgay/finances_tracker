import { readFileSync } from "fs";
import { extractPdfText } from "../lib/pdf";
import { extractTransactions } from "../lib/llm";

/**
 * End-to-end debugging script:
 *   npx tsx scripts/extract-pdf.ts "/path/to/statement.pdf"
 *
 * Prints exactly the text the LLM receives, then the parsed transactions —
 * reproducing the /api/extract PDF flow standalone, so you can tell whether
 * the problem is extraction, the model, or something server-specific.
 */
async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npx tsx scripts/extract-pdf.ts "<file.pdf>"');
    process.exit(1);
  }

  const { text, pages } = await extractPdfText(readFileSync(path));
  console.log(`===== EXTRACTED ${pages} page(s), ${text.length} chars =====`);
  console.log("===== TEXT SENT TO LLM =====\n");
  console.log(text);
  console.log("\n===== LLM RESULT =====\n");

  try {
    const { schema, rawResponse } = await extractTransactions(text);
    console.log("transactions:", schema.transactions.length);
    console.log(JSON.stringify(schema.transactions.slice(0, 5), null, 2));
    console.log("raw response (first 500):", rawResponse.slice(0, 500));
  } catch (e) {
    console.error("LLM ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
