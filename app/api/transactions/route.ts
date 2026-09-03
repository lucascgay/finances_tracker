import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALLOWED_CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";

type Category = (typeof ALLOWED_CATEGORIES)[number];
const isCategory = (v: unknown): v is Category =>
  typeof v === "string" && (ALLOWED_CATEGORIES as string[]).includes(v);

// GET /api/transactions?month=2026-09&category=Groceries&q=netflix&limit=500
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month");
  const category = sp.get("category");
  const q = sp.get("q")?.trim() || undefined;
  const limit = Math.min(Number(sp.get("limit") ?? 1000), 5000);

  const where: Record<string, unknown> = {};
  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where.date = { gte: start, lt: end };
    }
  }
  if (category && isCategory(category)) where.category = category;
  if (q) {
    where.OR = [
      { description: { contains: q } },
      { merchant: { contains: q } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: { statement: { select: { name: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total });
}

// PATCH and DELETE live in app/api/transactions/[id]/route.ts
