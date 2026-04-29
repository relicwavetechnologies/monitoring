import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z.object({
  url: z.string().url(),
  contentSelector: z.string().optional(),
  stripPatterns: z.array(z.string()).optional(),
  renderMode: z.enum(["STATIC", "JS"]).optional(),
  fetchMode: z.enum(["STATIC", "PLAYWRIGHT", "STEALTH", "EXTERNAL"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const urls = await db.monitoredUrl.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { snapshots: true, changes: true } } },
  });
  return NextResponse.json(urls);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: siteId } = await params;
  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const url = await db.monitoredUrl.create({
    data: {
      siteId,
      url: parsed.data.url,
      contentSelector: parsed.data.contentSelector ?? site.contentSelector,
      stripPatterns: parsed.data.stripPatterns ?? site.stripPatterns,
      renderMode: parsed.data.renderMode ?? site.renderMode,
      fetchMode: parsed.data.fetchMode ?? "STATIC",
    },
  });
  return NextResponse.json(url, { status: 201 });
}
