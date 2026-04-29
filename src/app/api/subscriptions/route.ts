import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateSchema = z
  .object({
    siteId: z.string().optional(),
    monitoredUrlId: z.string().optional(),
    channel: z.enum(["EMAIL", "SLACK", "WEBHOOK"]).default("EMAIL"),
    minSeverity: z.number().int().min(1).max(5).optional(),
    webhookUrl: z.string().url().optional(),
  })
  .refine((d) => d.siteId || d.monitoredUrlId, "siteId or monitoredUrlId required")
  .refine(
    (d) => d.channel === "EMAIL" || !!d.webhookUrl,
    "webhookUrl required for SLACK / WEBHOOK channels"
  );

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await db.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const sub = await db.subscription.create({
    data: { ...parsed.data, userId: session.user.id },
  });
  return NextResponse.json(sub, { status: 201 });
}
