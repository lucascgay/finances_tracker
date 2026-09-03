import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALLOWED_CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";

type Category = (typeof ALLOWED_CATEGORIES)[number];
const isCategory = (v: unknown): v is Category =>
  typeof v === "string" && (ALLOWED_CATEGORIES as string[]).includes(v);

// PATCH /api/transactions/:id  { category?, description?, merchant? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.category !== undefined) {
    if (!isCategory(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }
    data.category = body.category;
  }
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.merchant === "string") data.merchant = body.merchant;

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}

// DELETE /api/transactions/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
