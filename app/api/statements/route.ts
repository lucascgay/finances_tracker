import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/statements  — recently imported source documents with counts.
export async function GET() {
  const statements = await prisma.statement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { transactions: true } } },
  });
  return NextResponse.json({ statements });
}
