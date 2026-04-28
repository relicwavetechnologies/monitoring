import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { fetchSite } from "@/lib/pipeline/fetch";
import { extractContent } from "@/lib/pipeline/extract";
import { sha256, gzip } from "@/lib/pipeline/hash";
import { computeDiff } from "@/lib/pipeline/diff";
import { checkStability } from "@/lib/pipeline/stability";
import { classifyChange, categoryToEnum } from "@/lib/pipeline/classify";
import { maybeNotify } from "@/lib/pipeline/notify";

export type PollResult =
  | { status: "baseline"; snapshotId: string }
  | { status: "unchanged" }
  | { status: "insignificant_diff" }
  | { status: "pending_stability_check" }
  | { status: "change_detected"; changeId: string; classification: Classification }
  | { status: "fetch_failed"; error: string }
  | { status: "not_found" };

interface Classification {
  category: string;
  severity: number;
  confidence: number;
  summary: string;
  detail: string | null;
}

export async function runPoll(siteId: string): Promise<PollResult> {
  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site || !site.isActive) return { status: "not_found" };

  // Update lastCheckedAt immediately to prevent double-fire
  await db.site.update({ where: { id: siteId }, data: { lastCheckedAt: new Date() } });

  let fetchResult;
  try {
    fetchResult = await fetchSite(site.url, site.renderMode);
  } catch (err) {
    return { status: "fetch_failed", error: String(err) };
  }

  const cleanText = extractContent(fetchResult.html, site.contentSelector, site.stripPatterns);
  const newHash = sha256(cleanText);
  const htmlGz = new Uint8Array(gzip(fetchResult.html));
  const textGz = new Uint8Array(gzip(cleanText));

  const prevSnapshot = await db.snapshot.findFirst({
    where: { siteId },
    orderBy: { fetchedAt: "desc" },
  });

  const newSnapshot = await db.snapshot.create({
    data: { siteId, contentHash: newHash, htmlGz, textGz, httpStatus: fetchResult.status },
  });

  if (!prevSnapshot) return { status: "baseline", snapshotId: newSnapshot.id };

  if (prevSnapshot.contentHash === newHash) return { status: "unchanged" };

  const prevText = prevSnapshot.textGz
    ? gunzipSync(Buffer.from(prevSnapshot.textGz)).toString("utf8")
    : "";

  const diffResult = computeDiff(prevText, cleanText);

  if (!diffResult.isSignificant) return { status: "insignificant_diff" };

  const stability = await checkStability(siteId, newHash, diffResult.unified);
  if (stability === "pending") return { status: "pending_stability_check" };

  let classification: Classification;
  try {
    classification = await classifyChange(
      site.name,
      site.url,
      diffResult.addedLines,
      diffResult.removedLines
    );
  } catch {
    classification = {
      category: "UNKNOWN",
      severity: 2,
      confidence: 0,
      summary: "Change detected but classification failed",
      detail: null,
    };
  }

  const change = await db.change.create({
    data: {
      siteId,
      fromSnapshotId: prevSnapshot.id,
      toSnapshotId: newSnapshot.id,
      category: categoryToEnum(classification.category),
      severity: classification.severity,
      confidence: classification.confidence,
      summary: classification.summary,
      detail: classification.detail,
      diffText: diffResult.unified,
    },
  });

  await maybeNotify(change.id);

  return { status: "change_detected", changeId: change.id, classification };
}
