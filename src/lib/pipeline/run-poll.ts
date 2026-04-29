import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { crawlSite } from "@/lib/pipeline/crawl";
import { fetchSite } from "@/lib/pipeline/fetch";
import { extractContent } from "@/lib/pipeline/extract";
import { extractBlocks, computeBlocksHash, type Block } from "@/lib/pipeline/extract-blocks";
import { sha256, gzip } from "@/lib/pipeline/hash";
import { computeDiff } from "@/lib/pipeline/diff";
import { computeBlockDiff } from "@/lib/pipeline/diff-blocks";
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
  | { status: "not_found" }
  | { status: "paused" };

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

/**
 * Poll a single MonitoredUrl. The pipeline reads:
 *   - URL / selector / strip patterns / render mode → MonitoredUrl
 *   - Severity & confidence thresholds, confirm window, crawl scope → Site
 * On success, MonitoredUrl.lastCheckedAt and Site.lastCheckedAt are bumped.
 */
export async function runPoll(monitoredUrlId: string): Promise<PollResult> {
  const plog = log.child({ monitoredUrlId });
  try {
    const url = await db.monitoredUrl.findUnique({
      where: { id: monitoredUrlId },
      include: { site: true },
    });
    if (!url || !url.site) return { status: "not_found" };
    if (!url.site.isActive || url.paused) return { status: "paused" };

    const site = url.site;
    const siteId = site.id;

    const checkedAt = new Date();
    await Promise.all([
      db.monitoredUrl.update({ where: { id: monitoredUrlId }, data: { lastCheckedAt: checkedAt } }),
      // Site.lastCheckedAt is a denorm of MAX(monitoredUrls.lastCheckedAt). We
      // bump it monotonically so dashboard freshness stays correct without a
      // join. Worst case: it slightly leads behind a paused URL — fine.
      db.site.update({ where: { id: siteId }, data: { lastCheckedAt: checkedAt } }),
    ]);

    // ── Deep tree crawl ──────────────────────────────────────────────────────
    let crawlResult;
    try {
      crawlResult = await crawlSite(url.url, {
        contentSelector: url.contentSelector,
        stripPatterns: url.stripPatterns,
        maxDepth: site.maxCrawlDepth,
        maxPages: site.maxCrawlPages,
        pageTimeoutMs: 10_000,
      });
    } catch (err) {
      plog.error({ err, url: url.url }, "crawl failed");
      return { status: "fetch_failed", error: String(err) };
    }

    // ── Fallback: if crawl blocked (e.g. Cloudflare 403), use single-page fetch ─
    let cleanText: string;
    let pagesCrawled: number;
    let httpStatus: number;
    let manifest: string;

    // ── Block-level extraction (Phase 2a) ────────────────────────────────────
    const allBlocks: Block[] = [];
    let strategy: "SELECTOR" | "READABILITY" | "BODY" = "SELECTOR";
    const extractOpts = { selector: url.contentSelector, stripPatterns: url.stripPatterns };

    function pushPageBlocks(html: string, pageMarker: string | null) {
      if (pageMarker) {
        allBlocks.push({
          idx: allBlocks.length,
          blockHash: sha256(`page:${pageMarker}`),
          text: pageMarker,
          kind: "h2",
        });
      }
      const ext = extractBlocks(html, extractOpts);
      if (ext.strategy === "BODY") strategy = "BODY";
      for (const b of ext.blocks) {
        allBlocks.push({ ...b, idx: allBlocks.length });
      }
    }

    if (crawlResult.pages.length === 0) {
      plog.warn({ url: url.url }, "crawl returned 0 pages — falling back to single-page fetch");
      let fetchResult;
      try {
        fetchResult = await fetchSite(url.url, url.renderMode as RenderMode);
      } catch (err) {
        plog.error({ err, url: url.url }, "single-page fallback also failed");
        return { status: "fetch_failed", error: String(err) };
      }
      pushPageBlocks(fetchResult.html, null);
      cleanText = extractContent(fetchResult.html, url.contentSelector, url.stripPatterns);
      pagesCrawled = 1;
      httpStatus = fetchResult.status;
      manifest = JSON.stringify({
        crawledAt: new Date().toISOString(),
        pagesCrawled: 1,
        pagesDiscovered: 1,
        fallback: true,
        reason: "crawl_blocked",
        pages: [{ url: url.url, path: new URL(url.url).pathname, depth: 0, status: httpStatus, chars: cleanText.length }],
      });
    } else {
      const sortedPages = crawlResult.pages.slice().sort((a, b) => a.url.localeCompare(b.url));
      const rootPage = crawlResult.pages.find((p) => p.depth === 0) ?? crawlResult.pages[0];
      for (const p of sortedPages) {
        pushPageBlocks(p.html, `${p.path}${p.title ? ` | ${p.title}` : ""}`);
      }
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
    const newBlocksHash = computeBlocksHash(allBlocks);

    // ── Dedup short-circuit ──────────────────────────────────────────────────
    const prevSnapshot = await db.snapshot.findFirst({
      where: { monitoredUrlId },
      orderBy: { fetchedAt: "desc" },
    });

    const dedupByBlocks =
      !!prevSnapshot?.blocksHash && prevSnapshot.blocksHash === newBlocksHash;
    const dedupByText =
      !prevSnapshot?.blocksHash && !!prevSnapshot && prevSnapshot.contentHash === newHash;

    if (prevSnapshot && (dedupByBlocks || dedupByText)) {
      plog.debug(
        { hash: newHash, blocksHash: newBlocksHash, pagesCrawled, dedupByBlocks },
        "content unchanged — skipping snapshot write"
      );
      return { status: "unchanged", pagesCrawled };
    }

    const htmlGz = new Uint8Array(gzip(manifest));
    const textGz = new Uint8Array(gzip(cleanText));
    const newSnapshot = await db.snapshot.create({
      data: {
        siteId,
        monitoredUrlId,
        contentHash: newHash,
        blocksHash: newBlocksHash,
        extractStrategy: strategy,
        htmlGz,
        textGz,
        httpStatus,
        blocks: {
          create: allBlocks.map((b) => ({
            idx: b.idx,
            blockHash: b.blockHash,
            text: b.text,
            kind: b.kind,
          })),
        },
      },
    });

    if (!prevSnapshot) {
      return { status: "baseline", snapshotId: newSnapshot.id, pagesCrawled };
    }

    // ── Diff ─────────────────────────────────────────────────────────────────
    let diffResult: { unified: string; isSignificant: boolean; addedLines: string[]; removedLines: string[] };
    if (prevSnapshot.blocksHash) {
      const prevBlocks = await db.snapshotBlock.findMany({
        where: { snapshotId: prevSnapshot.id },
        select: { blockHash: true, text: true, kind: true, idx: true },
        orderBy: { idx: "asc" },
      });
      const blockDiff = computeBlockDiff(prevBlocks, allBlocks, { minDiffChars: site.minDiffChars });
      diffResult = {
        unified: blockDiff.unified,
        isSignificant: blockDiff.isSignificant,
        addedLines: blockDiff.added.map((b) => b.text).concat(blockDiff.edited.map((p) => p.after.text)),
        removedLines: blockDiff.removed.map((b) => b.text).concat(blockDiff.edited.map((p) => p.before.text)),
      };
      plog.debug(
        {
          added: blockDiff.added.length,
          removed: blockDiff.removed.length,
          edited: blockDiff.edited.length,
          changedChars: blockDiff.changedChars,
        },
        "block-level diff computed"
      );
    } else {
      const prevText = prevSnapshot.textGz
        ? gunzipSync(Buffer.from(prevSnapshot.textGz)).toString("utf8")
        : "";
      const textDiff = computeDiff(prevText, cleanText, { minDiffChars: site.minDiffChars });
      diffResult = {
        unified: textDiff.unified,
        isSignificant: textDiff.isSignificant,
        addedLines: textDiff.addedLines,
        removedLines: textDiff.removedLines,
      };
    }

    if (!diffResult.isSignificant) return { status: "insignificant_diff" };

    // ── Stability check (per-URL) ────────────────────────────────────────────
    const stability = await checkStability(monitoredUrlId, newHash, diffResult.unified);
    if (stability === "pending") return { status: "pending_stability_check" };

    // ── Classify ─────────────────────────────────────────────────────────────
    let classification: Classification;
    try {
      classification = await classifyChange(
        site.name,
        url.url,
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

    // ── Persist change & notify (idempotent on (monitoredUrlId, fromHash, toHash)) ──
    const fromContentHash = prevSnapshot.contentHash;
    const toContentHash = newHash;

    let change;
    try {
      change = await db.change.create({
        data: {
          siteId,
          monitoredUrlId,
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
        const existing = await db.change.findFirst({
          where: { monitoredUrlId, fromContentHash, toContentHash },
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

/**
 * Convenience wrapper: poll every active MonitoredUrl on the given Site.
 * Used by the legacy "poll this site" admin endpoint and the cron tick.
 * Sequential by default — per-host concurrency control comes in Phase 4.
 */
export async function runPollForSite(siteId: string): Promise<PollResult[]> {
  const urls = await db.monitoredUrl.findMany({
    where: { siteId, paused: false, site: { isActive: true } },
    select: { id: true },
  });
  const results: PollResult[] = [];
  for (const u of urls) {
    results.push(await runPoll(u.id));
  }
  return results;
}
