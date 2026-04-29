import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Acknowledge a Change. Once acknowledged, no further notifications fire
 * for it (including the per-channel subscription delivery). Idempotent.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const updated = await db.change.update({
    where: { id },
    data: { acknowledgedAt: new Date(), acknowledgedById: session.user.id },
    select: { id: true, acknowledgedAt: true, acknowledgedById: true },
  });
  return NextResponse.json(updated);
}
