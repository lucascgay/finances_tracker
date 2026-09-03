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

/**
 * The window of dates we consider plausible for a statement. We use month
 * boundaries (not the exact current timestamp) so a transaction dated later
 * in the current month is still kept. Statements are recent, so we reject
 * anything older than the previous 14 months or more than ~1 month in the
 * future. This guards against the model latching onto a stray year from a
 * header/footer (e.g. misreading a statement as "2022" instead of 2026).
 */
export function isPlausibleDate(date: Date, now: Date = new Date()): boolean {
  const min = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 14, 1)
  );
  const max = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return date >= min && date < max;
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

    // Drop rows lacking a usable date or with an implausible one (stray year).
    if (!date || !isPlausibleDate(date)) continue;

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
