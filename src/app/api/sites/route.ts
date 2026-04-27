import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateSiteSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  renderMode: z.enum(["STATIC", "JS"]).default("STATIC"),
  contentSelector: z.string().default("body"),
  stripPatterns: z.array(z.string()).default([]),
  pollIntervalMin: z.number().int().min(15).max(1440).default(60),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = await db.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { changes: true, snapshots: true } },
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 1,
        select: { severity: true, summary: true, detectedAt: true, category: true },
      },
    },
  });

  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const site = await db.site.create({ data: parsed.data });
  return NextResponse.json(site, { status: 201 });
}
