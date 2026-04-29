import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { crawlSite } from "@/lib/pipeline/crawl";
import { fetchSite } from "@/lib/pipeline/fetch";
import { extractContent } from "@/lib/pipeline/extract";
import { sha256, gzip } from "@/lib/pipeline/hash";
import { computeDiff } from "@/lib/pipeline/diff";
import { checkStability } from "@/lib/pipeline/stability";
import { classifyChange, categoryToEnum } from "@/lib/pipeline/classify";
import { maybeNotify } from "@/lib/pipeline/notify";
import { getLogger } from "@/lib/logger";
import type { RenderMode } from "@/generated/prisma/enums";

const log = getLogger("pipeline.run-poll");

export type PollResult =
  | { status: "baseline"; snapshotId: string; pagesCrawled: number }
  | { status: "unchanged"; pagesCrawled: number }
  | { status: "insignificant_diff" }
  | { status: "pending_stability_check" }
  | { status: "change_detected"; changeId: string; classification: Classification }
  | { status: "duplicate_change"; changeId: string }
  | { status: "fetch_failed"; error: string }
  | { status: "not_found" };

interface Classification {
  category: string;
  severity: number;
  confidence: number;
  summary: string;
  detail: string | null;
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Build stable aggregated text from crawled pages.
 * Pages are sorted by URL so the order is deterministic across polls —
 * a new page appearing / disappearing will itself count as a diff.
 */
function aggregatePages(
  pages: Array<{ url: string; path: string; title: string; text: string }>
): string {
  return pages
    .slice()
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((p) => {
      const heading = `=== ${p.path}${p.title ? ` | ${p.title}` : ""} ===`;
      return `${heading}\n${p.text.trim()}`;
    })
    .join("\n\n");
}

export async function runPoll(siteId: string): Promise<PollResult> {
  const plog = log.child({ siteId });
  try {
    const site = await db.site.findUnique({ where: { id: siteId } });
    if (!site || !site.isActive) return { status: "not_found" };

    await db.site.update({ where: { id: siteId }, data: { lastCheckedAt: new Date() } });

    // ── Deep tree crawl ──────────────────────────────────────────────────────
    let crawlResult;
    try {
      crawlResult = await crawlSite(site.url, {
        contentSelector: site.contentSelector,
        stripPatterns: site.stripPatterns,
        maxDepth: site.maxCrawlDepth,
        maxPages: site.maxCrawlPages,
        pageTimeoutMs: 10_000,
      });
    } catch (err) {
      plog.error({ err, url: site.url }, "crawl failed");
      return { status: "fetch_failed", error: String(err) };
    }

    // ── Fallback: if crawl blocked (e.g. Cloudflare 403), use single-page fetch ─
    let cleanText: string;
    let pagesCrawled: number;
    let httpStatus: number;
    let manifest: string;

    if (crawlResult.pages.length === 0) {
      plog.warn({ url: site.url }, "crawl returned 0 pages — falling back to single-page fetch");
      let fetchResult;
      try {
        fetchResult = await fetchSite(site.url, site.renderMode as RenderMode);
      } catch (err) {
        plog.error({ err, url: site.url }, "single-page fallback also failed");
        return { status: "fetch_failed", error: String(err) };
      }
      cleanText = extractContent(fetchResult.html, site.contentSelector, site.stripPatterns);
      pagesCrawled = 1;
      httpStatus = fetchResult.status;
      manifest = JSON.stringify({
        crawledAt: new Date().toISOString(),
        pagesCrawled: 1,
        pagesDiscovered: 1,
        fallback: true,
        reason: "crawl_blocked",
        pages: [{ url: site.url, path: new URL(site.url).pathname, depth: 0, status: httpStatus, chars: cleanText.length }],
      });
    } else {
      const rootPage = crawlResult.pages.find((p) => p.depth === 0) ?? crawlResult.pages[0];
      cleanText = aggregatePages(crawlResult.pages);
      pagesCrawled = crawlResult.pages.length;
      httpStatus = rootPage.status;
      manifest = JSON.stringify({
        crawledAt: new Date().toISOString(),
        pagesCrawled,
        pagesDiscovered: crawlResult.totalDiscovered,
        pages: crawlResult.pages.map((p) => ({
          url: p.url,
          path: p.path,
          title: p.title,
          depth: p.depth,
          status: p.status,
          chars: p.text.length,
        })),
      });
    }

    const newHash = sha256(cleanText);

    // ── Dedup short-circuit ──────────────────────────────────────────────────
    // If the freshly-extracted content hashes the same as the last stored
    // snapshot, write nothing new — just acknowledge the poll. This kills
    // ~90% of DB churn and LLM cost on stable sites.
    const prevSnapshot = await db.snapshot.findFirst({
      where: { siteId },
      orderBy: { fetchedAt: "desc" },
    });

    if (prevSnapshot && prevSnapshot.contentHash === newHash) {
      plog.debug({ hash: newHash, pagesCrawled }, "content unchanged — skipping snapshot write");
      return { status: "unchanged", pagesCrawled };
    }

    const htmlGz = new Uint8Array(gzip(manifest));
    const textGz = new Uint8Array(gzip(cleanText));
    const newSnapshot = await db.snapshot.create({
      data: { siteId, contentHash: newHash, htmlGz, textGz, httpStatus },
    });

    if (!prevSnapshot) {
      return { status: "baseline", snapshotId: newSnapshot.id, pagesCrawled };
    }

    // ── Diff ─────────────────────────────────────────────────────────────────
    const prevText = prevSnapshot.textGz
      ? gunzipSync(Buffer.from(prevSnapshot.textGz)).toString("utf8")
      : "";

    const diffResult = computeDiff(prevText, cleanText, { minDiffChars: site.minDiffChars });
    if (!diffResult.isSignificant) return { status: "insignificant_diff" };

    // ── Stability check ──────────────────────────────────────────────────────
    const stability = await checkStability(siteId, newHash, diffResult.unified);
    if (stability === "pending") return { status: "pending_stability_check" };

    // ── Classify ─────────────────────────────────────────────────────────────
    let classification: Classification;
    try {
      classification = await classifyChange(
        site.name,
        site.url,
        diffResult.addedLines,
        diffResult.removedLines
      );
    } catch (err) {
      plog.error({ err }, "classify failed");
      classification = {
        category: "UNKNOWN",
        severity: 2,
        confidence: 0,
        summary: "Change detected but classification failed",
        detail: null,
      };
    }

    // ── Persist change & notify (idempotent on (siteId, fromHash, toHash)) ──
    const fromContentHash = prevSnapshot.contentHash;
    const toContentHash = newHash;

    let change;
    try {
      change = await db.change.create({
        data: {
          siteId,
          fromSnapshotId: prevSnapshot.id,
          toSnapshotId: newSnapshot.id,
          fromContentHash,
          toContentHash,
          category: categoryToEnum(classification.category),
          severity: classification.severity,
          confidence: classification.confidence,
          summary: classification.summary,
          detail: classification.detail,
          diffText: diffResult.unified,
        },
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        // Same hash transition is already recorded — common when a site flaps
        // between two states. Surface the existing change rather than failing.
        const existing = await db.change.findFirst({
          where: { siteId, fromContentHash, toContentHash },
          select: { id: true },
        });
        plog.info({ fromContentHash, toContentHash, changeId: existing?.id }, "duplicate change suppressed");
        return existing
          ? { status: "duplicate_change", changeId: existing.id }
          : { status: "fetch_failed", error: "duplicate change but lookup empty" };
      }
      throw err;
    }

    await maybeNotify(change.id);

    return { status: "change_detected", changeId: change.id, classification };
  } catch (err) {
    plog.error({ err }, "unexpected error in runPoll");
    return { status: "fetch_failed", error: String(err) };
  }
}
