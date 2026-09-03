import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALLOWED_CATEGORIES, CATEGORY_META, monthKey } from "@/lib/categories";

export const runtime = "nodejs";

/**
 * GET /api/budgets?month=2026-09
 * Returns per-category budgeted amounts plus actual spend for that month,
 * plus an overall summary and remaining funds.
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const key = month ?? monthKey(new Date());
  const [y, m] = key.split("-").map(Number);

  if (!y || !m) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const [budgets, transactions] = await Promise.all([
    prisma.budget.findMany({ where: { month: key } }),
    // Only expenses count toward budget (amounts are negative).
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end }, amount: { lt: 0 } },
      select: { category: true, amount: true },
    }),
  ]);

  const budgetMap = new Map(budgets.map((b) => [b.category, b.amount]));

  // Actual spend per category (spend is shown as positive).
  const spend = new Map<string, number>();
  for (const t of transactions) {
    spend.set(t.category, (spend.get(t.category) ?? 0) + Math.abs(t.amount));
  }

  const categories = ALLOWED_CATEGORIES.map((c) => ({
    category: c,
    label: CATEGORY_META[c]?.label ?? c,
    budgeted: budgetMap.get(c) ?? 0,
    spent: Math.round((spend.get(c) ?? 0) * 100) / 100,
  })).filter((c) => c.budgeted > 0 || c.spent > 0);

  const totalBudgeted = categories.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

  return NextResponse.json({
    month: key,
    categories,
    summary: {
      totalBudgeted: Math.round(totalBudgeted * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round((totalBudgeted - totalSpent) * 100) / 100,
    },
  });
}

/**
 * PUT /api/budgets { month: "2026-09", budgets: [{ category, amount }] }
 * Upserts the budget rows for a month. amount 0 removes the budget.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const month = String(body.month ?? monthKey(new Date()));
  const budgets: { category: string; amount: number }[] = Array.isArray(
    body.budgets
  )
    ? body.budgets
    : [];

  const valid = budgets.filter((b) =>
    (ALLOWED_CATEGORIES as string[]).includes(b.category)
  );

  await prisma.$transaction([
    prisma.budget.deleteMany({ where: { month } }),
    ...valid
      .filter((b) => Number(b.amount) > 0)
      .map((b) =>
        prisma.budget.create({
          data: { month, category: b.category as never, amount: Number(b.amount) },
        })
      ),
  ]);

  return NextResponse.json({ ok: true, saved: valid.length });
}
