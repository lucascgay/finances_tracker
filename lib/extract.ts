import { z } from "zod";
import { ALLOWED_CATEGORIES } from "./categories";

/**
 * The strict JSON contract the LLM must produce. Validated with Zod so a bad
 * model response is caught and normalized instead of crashing the app.
 */
export const RawTransactionSchema = z.object({
  date: z.string(), // "YYYY-MM-DD"
  description: z.string().min(1),
  merchant: z.string().optional().nullable(), // inferred from description when missing
  amount: z.number(), // signed USD
  category: z.enum(ALLOWED_CATEGORIES as [string, ...string[]]),
  sourceType: z.enum([
    "CreditCardStatement",
    "UtilityBill",
    "ManualPaste",
  ]),
});

export const ExtractionResponseSchema = z.object({
  transactions: z.array(RawTransactionSchema),
});

export type RawTransaction = z.infer<typeof RawTransactionSchema>;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse an ISO date produced by the model, falling back safely. */
export function toDate(iso: string): Date | null {
  const m = DATE_RE.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cheap intersection dedupe using a normalized fingerprint. */
export function fingerprint(t: RawTransaction, date: Date): string {
  const merchant = (t.merchant ?? t.description).trim().toLowerCase();
  return `${date.toISOString().slice(0, 10)}|${merchant}|${t.amount.toFixed(2)}`;
}

/**
 * Normalize + sanitize a raw model response into rows ready for the DB.
 * - Forces a strictly-negative/positive sign convention.
 * - Drops rows that lack a usable date or amount.
 */
export function normalizeTransactions(
  raw: z.infer<typeof ExtractionResponseSchema>
): { date: Date; amount: number; description: string; merchant: string; category: RawTransaction["category"]; sourceType: RawTransaction["sourceType"] }[] {
  const seen = new Set<string>();
  const out: ReturnType<typeof normalizeTransactions> = [];

  for (const t of raw.transactions) {
    const date = toDate(t.date);
    if (!date) continue;

    // Guard against absurd magnitudes / NaN from bad models.
    if (!Number.isFinite(t.amount) || Math.abs(t.amount) > 100_000_000) continue;

    // Enforce sign convention: expenses negative, income positive.
    const isIncome = t.category === "Income_Credit";
    const amount = isIncome ? Math.abs(t.amount) : -Math.abs(t.amount);

    const merchant = (t.merchant ?? t.description).trim().slice(0, 200) || "Unknown";

    const fp = fingerprint({ ...t, amount, merchant }, date);
    if (seen.has(fp)) continue;
    seen.add(fp);

    out.push({
      date,
      amount,
      description: t.description.trim().slice(0, 500),
      merchant,
      category: t.category,
      sourceType: t.sourceType,
    });
  }

  return out;
}
