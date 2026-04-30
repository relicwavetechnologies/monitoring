/**
 * Phase 8: bootstrap a new site by crawling it and generating one topic
 * card per discovered sub-page. The wizard renders these cards as a grid;
 * the user dismisses noise and clicks Save, which POSTs to /api/sites with
 * the surviving cards.
 *
 * Returns:
 *   - siteName: a short label inferred from the root page <title>
 *   - rootOrigin
 *   - fetchModeUsed: which tier had to be used to reach the site
 *   - pages: BootstrapPage[] (each with a TopicCard or null + skipped flag)
 *   - errors: list of per-URL fetch failures
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bootstrapCrawl } from "@/lib/adapters/bootstrap-crawl";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().int().min(1).max(50).optional(),
  maxDepth: z.number().int().min(0).max(3).optional(),
});

function deriveSiteName(rootUrl: string, rootTitle?: string): string {
  if (rootTitle && rootTitle.length > 0) {
    // Take everything before " | " or " - " separators which are usually
    // "Page name | Site name"
    const parts = rootTitle.split(/\s+[|\-–]\s+/);
    const siteSegment = parts[parts.length - 1] ?? rootTitle;
    return siteSegment.trim().slice(0, 100);
  }
  try {
    const u = new URL(rootUrl);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "Untitled site";
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await bootstrapCrawl(parsed.data.url, {
      maxPages: parsed.data.maxPages ?? 25,
      maxDepth: parsed.data.maxDepth ?? 2,
    });

    const rootPage = result.pages.find((p) => p.depth === 0) ?? result.pages[0];
    const siteName = deriveSiteName(parsed.data.url, rootPage?.title);

    return NextResponse.json({
      siteName,
      rootOrigin: result.rootOrigin,
      fetchModeUsed: result.fetchModeUsed,
      totalDiscovered: result.totalDiscovered,
      pages: result.pages.map((p) => ({
        url: p.url,
        path: p.path,
        title: p.title,
        depth: p.depth,
        skipped: p.skipped,
        card: p.card,
        textPreview: p.text.slice(0, 600),
      })),
      errors: result.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `bootstrap failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
