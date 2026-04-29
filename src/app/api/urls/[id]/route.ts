import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  url: z.string().url().optional(),
  contentSelector: z.string().optional(),
  stripPatterns: z.array(z.string()).optional(),
  renderMode: z.enum(["STATIC", "JS"]).optional(),
  fetchMode: z.enum(["STATIC", "PLAYWRIGHT", "STEALTH", "EXTERNAL"]).optional(),
  paused: z.boolean().optional(),
  autoEscalate: z.boolean().optional(),
  escalateAfterFailures: z.number().int().min(1).max(20).optional(),
  mutePatterns: z.array(z.string()).optional(),
  // Reset the failure streak — useful after a manual investigation.
  resetFailures: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = await db.monitoredUrl.findUnique({
    where: { id },
    include: {
      site: true,
      _count: { select: { snapshots: true, changes: true } },
    },
  });
  if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(url);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { resetFailures, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (resetFailures) {
    data.consecutiveFailures = 0;
    data.lastFailureKind = null;
  }

  const url = await db.monitoredUrl.update({ where: { id }, data });
  return NextResponse.json(url);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.monitoredUrl.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
