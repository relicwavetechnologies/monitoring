import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  CATEGORY_POLL_DEFAULTS,
  TOPIC_CATEGORIES,
  type StoredTopicCard,
} from "@/lib/adapters/topic-card";
import { Prisma } from "@/generated/prisma/client";

/** Shape passed by the wizard for each kept page. */
const TopicCardSchema = z.object({
  title: z.string().min(1).max(140),
  summary: z.string().min(1).max(400),
  category: z.enum(TOPIC_CATEGORIES),
  importantFields: z.array(z.string().min(1).max(140)).max(8).default([]),
  contentSelector: z.string().max(200).nullable().default(null),
});

const UrlEntrySchema = z.object({
  url: z.string().url(),
  card: TopicCardSchema.nullable(),
  /** Per-URL poll interval override. If absent, use category default or
   *  the site default. */
  pollIntervalMin: z.number().int().min(15).max(1440).nullable().optional(),
});

/** New (Phase 8) create-site shape — driven by the topic-card wizard. */
const CreateSiteV2Schema = z.object({
  name: z.string().min(1).max(100),
  rootUrl: z.string().url(),
  /** Default cadence applied to every URL that doesn't specify one. */
  pollIntervalDefault: z.number().int().min(15).max(1440).default(60),
  isActive: z.boolean().default(true),
  urls: z.array(UrlEntrySchema).min(1),
});

/** Legacy (pre-Phase-8) create-site shape. Still accepted so older callers
 *  (curl scripts, tests) keep working — creates one MonitoredUrl with no card. */
const CreateSiteV1Schema = z.object({
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
      _count: { select: { changes: true, snapshots: true, monitoredUrls: true } },
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

  // Try the new (Phase 8) shape first.
  const v2 = CreateSiteV2Schema.safeParse(body);
  if (v2.success) {
    const { name, rootUrl, pollIntervalDefault, isActive, urls } = v2.data;
    const site = await db.site.create({
      data: {
        name,
        url: rootUrl,
        pollIntervalMin: pollIntervalDefault,
        isActive,
        // Legacy site-level defaults — kept harmless. Per-URL config wins.
        contentSelector: "body",
        renderMode: "STATIC",
        stripPatterns: [],
        monitoredUrls: {
          create: urls.map((u) => {
            // Per-URL polling cadence (computed from category default, kept
            // here for future use — cadence currently lives on Site).
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _cadence =
              u.pollIntervalMin ??
              CATEGORY_POLL_DEFAULTS[u.card?.category ?? "OTHER"] ??
              pollIntervalDefault;
            const stored: StoredTopicCard | null = u.card
              ? { ...u.card, lastChangeNote: null, lastChangeAt: null }
              : null;
            return {
              url: u.url,
              contentSelector: u.card?.contentSelector ?? "main",
              stripPatterns: [],
              renderMode: "STATIC" as const,
              topicCard: (stored as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              topicCardAt: stored ? new Date() : null,
            };
          }),
        },
      },
      include: { monitoredUrls: true },
    });
    return NextResponse.json(site, { status: 201 });
  }

  // Fall through to the legacy shape.
  const v1 = CreateSiteV1Schema.safeParse(body);
  if (!v1.success) {
    return NextResponse.json({ error: v1.error.flatten() }, { status: 422 });
  }
  const site = await db.site.create({
    data: {
      ...v1.data,
      monitoredUrls: {
        create: [
          {
            url: v1.data.url,
            contentSelector: v1.data.contentSelector,
            stripPatterns: v1.data.stripPatterns,
            renderMode: v1.data.renderMode,
          },
        ],
      },
    },
    include: { monitoredUrls: true },
  });
  return NextResponse.json(site, { status: 201 });
}
