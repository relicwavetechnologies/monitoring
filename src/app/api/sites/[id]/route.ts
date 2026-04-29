import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  renderMode: z.enum(["STATIC", "JS"]).optional(),
  contentSelector: z.string().optional(),
  stripPatterns: z.array(z.string()).optional(),
  pollIntervalMin: z.number().int().min(15).max(1440).optional(),
  isActive: z.boolean().optional(),
  // Per-site tunables introduced in Phase 1 — clients can adjust these
  // without a redeploy. The bounds are intentionally permissive; bad values
  // degrade noisily rather than break the pipeline.
  minDiffChars: z.number().int().min(0).max(100_000).optional(),
  severityThreshold: z.number().int().min(1).max(5).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  confirmAfterHours: z.number().int().min(0).max(720).optional(),
  maxCrawlDepth: z.number().int().min(0).max(5).optional(),
  maxCrawlPages: z.number().int().min(1).max(200).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: {
      changes: { orderBy: { detectedAt: "desc" }, take: 50 },
      _count: { select: { snapshots: true, changes: true } },
    },
  });

  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(site);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const site = await db.site.update({ where: { id }, data: parsed.data });
  return NextResponse.json(site);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.site.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
