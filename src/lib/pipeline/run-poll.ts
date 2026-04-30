import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { dispatchFetch } from "@/lib/pipeline/fetchers";
import { decideNextTier } from "@/lib/pipeline/fetchers/tier-escalation";
import { extractContent } from "@/lib/pipeline/extract";
import { extractBlocks, computeBlocksHash, type Block } from "@/lib/pipeline/extract-blocks";
import { sha256, gzip } from "@/lib/pipeline/hash";
import { computeDiff } from "@/lib/pipeline/diff";
import { computeBlockDiff } from "@/lib/pipeline/diff-blocks";
import { isAmbiguousDiff, semanticSimilarity } from "@/lib/pipeline/semantic-diff";
import { visualHashFromPng, visuallyIdentical } from "@/lib/pipeline/visual-hash";
import { checkStability } from "@/lib/pipeline/stability";
import { classifyChange, type ClassifyResult } from "@/lib/pipeline/classify";
import { maybeNotify } from "@/lib/pipeline/notify";
import { shouldMute } from "@/lib/pipeline/mute";
import { deliverToSubscribers } from "@/lib/pipeline/subscriptions";
import { refreshTopicCard } from "@/lib/pipeline/topic-card-refresh";
import type { StoredTopicCard } from "@/lib/adapters/topic-card";
import { ChangeCategory } from "@/generated/prisma/enums";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.run-poll");

export type PollResult =
  | { status: "baseline"; snapshotId: string; pagesCrawled: number }
  | { status: "unchanged"; pagesCrawled: number }
  | { status: "insignificant_diff" }
  | { status: "semantically_unchanged"; similarity: number }
  | { status: "pending_stability_check" }
  | { status: "change_detected"; changeId: string; classification: ClassifyResult }
  | { status: "duplicate_change"; changeId: string }
  | { status: "fetch_failed"; error: string }
  | { status: "not_found" }
  | { status: "paused" };

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
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

    // ── Phase 8: single-URL fetch via the tier dispatcher ───────────────────
    // Each MonitoredUrl is now its own page (the bootstrap crawler produced
    // them at site-add time). No in-poll BFS — that contaminated snapshots
    // by aggregating 20 pages into one hash.
    const dispatch = await dispatchFetch({ url: url.url, mode: url.fetchMode });

    if (dispatch.outcome.kind !== "OK") {
      const decision = decideNextTier({
        currentMode: url.fetchMode,
        consecutiveFailures: url.consecutiveFailures,
        outcomeKind: dispatch.outcome.kind,
        autoEscalate: url.autoEscalate,
        escalateAfter: url.escalateAfterFailures,
      });
      await db.monitoredUrl.update({
        where: { id: monitoredUrlId },
        data: {
          fetchMode: decision.newMode,
          consecutiveFailures: decision.newConsecutiveFailures,
          lastFailureAt: decision.recordFailureNow ? new Date() : url.lastFailureAt,
          lastFailureKind: decision.newFailureKind,
        },
      });
      if (decision.escalated) {
        plog.warn(
          {
            url: url.url,
            from: url.fetchMode,
            to: decision.newMode,
            reason: dispatch.outcome.reason,
          },
          "fetch tier escalated"
        );
      }
      return {
        status: "fetch_failed",
        error: `${dispatch.outcome.kind}${dispatch.outcome.reason ? `:${dispatch.outcome.reason}` : ""}`,
      };
    }

    // Successful fetch → reset the failure streak.
    if (url.consecutiveFailures !== 0 || url.lastFailureKind !== null) {
      await db.monitoredUrl.update({
        where: { id: monitoredUrlId },
        data: { consecutiveFailures: 0, lastFailureKind: null },
      });
    }

    // ── Block-level extraction (selector-scoped) ────────────────────────────
    const allBlocks: Block[] = [];
    let strategy: "SELECTOR" | "READABILITY" | "BODY" = "SELECTOR";
    const ext = extractBlocks(dispatch.html, {
      selector: url.contentSelector,
      stripPatterns: url.stripPatterns,
    });
    if (ext.strategy === "BODY") strategy = "BODY";
    for (const b of ext.blocks) {
      allBlocks.push({ ...b, idx: allBlocks.length });
    }

    const cleanText = extractContent(dispatch.html, url.contentSelector, url.stripPatterns);
    const pagesCrawled = 1;
    const httpStatus = dispatch.status;
    const manifest = JSON.stringify({
      fetchedAt: new Date().toISOString(),
      fetchMode: url.fetchMode,
      durationMs: dispatch.durationMs,
      url: url.url,
      path: new URL(url.url).pathname,
      status: httpStatus,
      chars: cleanText.length,
      blocks: allBlocks.length,
    });

    const newHash = sha256(cleanText);
    const newBlocksHash = computeBlocksHash(allBlocks);

    // ── Phase 8: visual hash (when the fetcher produced a screenshot) ───────
    let newVisualHash: string | null = null;
    if (dispatch.screenshot) {
      newVisualHash = await visualHashFromPng(dispatch.screenshot);
    }

    // ── Dedup short-circuit ──────────────────────────────────────────────────
    const prevSnapshot = await db.snapshot.findFirst({
      where: { monitoredUrlId },
      orderBy: { fetchedAt: "desc" },
    });

    const dedupByBlocks =
      !!prevSnapshot?.blocksHash && prevSnapshot.blocksHash === newBlocksHash;
    const dedupByText =
      !prevSnapshot?.blocksHash && !!prevSnapshot && prevSnapshot.contentHash === newHash;
    // Phase 8: third dedup signal — perceptual hash of the rendered viewport.
    // Catches the SPA hydration race where DOM text bytes flicker but the
    // rendered pixels are identical.
    const dedupByVisual =
      !!prevSnapshot?.visualHash &&
      !!newVisualHash &&
      visuallyIdentical(prevSnapshot.visualHash, newVisualHash);

    if (prevSnapshot && (dedupByBlocks || dedupByText || dedupByVisual)) {
      plog.debug(
        {
          hash: newHash,
          blocksHash: newBlocksHash,
          visualHash: newVisualHash,
          pagesCrawled,
          dedupByBlocks,
          dedupByVisual,
        },
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
        visualHash: newVisualHash,
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

    // ── Phase 8: semantic-similarity short-circuit ───────────────────────────
    // For ambiguous diffs (a lot of changed chars but possibly just rewording
    // the same paragraphs), embed both texts and compute cosine similarity.
    // Skips if the LLM call fails (returns null) — we just proceed.
    if (isAmbiguousDiff(diffResult.unified, cleanText.length)) {
      const prevText = prevSnapshot.textGz
        ? gunzipSync(Buffer.from(prevSnapshot.textGz)).toString("utf8")
        : "";
      const sim = await semanticSimilarity(prevText, cleanText);
      if (sim !== null && sim >= 0.92) {
        plog.info(
          { similarity: sim, url: url.url },
          "diff was structurally large but semantically near-identical — skipping"
        );
        return { status: "semantically_unchanged", similarity: sim };
      }
    }

    // ── Stability check (per-URL) ────────────────────────────────────────────
    const stability = await checkStability(monitoredUrlId, newHash, diffResult.unified);
    if (stability === "pending") return { status: "pending_stability_check" };

    // ── Classify (rules + grounded LLM with escalation, Phase 3) ────────────
    let classification: ClassifyResult;
    try {
      classification = await classifyChange({
        siteName: site.name,
        siteUrl: url.url,
        addedLines: diffResult.addedLines,
        removedLines: diffResult.removedLines,
        diffText: diffResult.unified,
      });
    } catch (err) {
      plog.error({ err }, "classify wrapper threw");
      classification = {
        category: ChangeCategory.UNKNOWN,
        severity: 2,
        confidence: 0,
        summary: "Change detected but classification failed",
        detail: null,
        evidenceQuotes: [],
        status: "FALLBACK",
        rawSeverity: 2,
        model: "fallback",
        promptVersion: "v2",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      };
    }

    // ── Persist change & notify (idempotent on (monitoredUrlId, fromHash, toHash)) ──
    const fromContentHash = prevSnapshot.contentHash;
    const toContentHash = newHash;

    // Phase 7: per-URL mute patterns. Muted changes are still recorded
    // for audit but never trigger notifications.
    const muteCheck = shouldMute({
      summary: classification.summary,
      detail: classification.detail,
      category: classification.category,
      mutePatterns: url.mutePatterns,
    });
    if (muteCheck.muted) {
      plog.info(
        { matchedPattern: muteCheck.matchedPattern },
        "change auto-muted by URL mutePatterns"
      );
    }

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
          category: classification.category,
          severity: classification.severity,
          confidence: classification.confidence,
          summary: classification.summary,
          detail: classification.detail,
          diffText: diffResult.unified,
          muted: muteCheck.muted,
          // Phase 3 metadata
          classifierStatus: classification.status,
          evidenceQuotes: classification.evidenceQuotes,
          classifierPromptVersion: classification.promptVersion,
          classifierModel: classification.model,
          classifierTokensIn: classification.tokensIn,
          classifierTokensOut: classification.tokensOut,
          classifierCostUsd: classification.costUsd,
          classifierRawSeverity: classification.rawSeverity,
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

    // ── Phase 8: refresh the topic card with a "what's new" note ────────────
    if (url.topicCard) {
      try {
        const refreshed = await refreshTopicCard({
          card: url.topicCard as unknown as StoredTopicCard,
          changeSummary: classification.summary,
          changeDetail: classification.detail,
          diffText: diffResult.unified,
        });
        await db.monitoredUrl.update({
          where: { id: monitoredUrlId },
          data: {
            topicCard: refreshed as unknown as object,
            topicCardAt: new Date(),
          },
        });
      } catch (err) {
        plog.warn({ err }, "topic card refresh threw — continuing");
      }
    }

    // Phase 7: subscriber delivery (per-channel). Skipped when muted.
    if (!muteCheck.muted) {
      try {
        const delivery = await deliverToSubscribers(change.id);
        plog.info({ changeId: change.id, ...delivery }, "subscriber delivery");
      } catch (err) {
        plog.warn({ err, changeId: change.id }, "subscriber delivery threw — continuing");
      }
      // Phase 1 single-recipient email path stays as a backstop for
      // installations that haven't migrated their User.receivesAlerts to
      // explicit Subscriptions yet.
      await maybeNotify(change.id);
    }

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
