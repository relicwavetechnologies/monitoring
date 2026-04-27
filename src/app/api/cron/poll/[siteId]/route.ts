import { NextRequest, NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { db } from "@/lib/db";
import { fetchSite } from "@/lib/pipeline/fetch";
import { extractContent } from "@/lib/pipeline/extract";
import { sha256, gzip } from "@/lib/pipeline/hash";
import { computeDiff } from "@/lib/pipeline/diff";
import { checkStability } from "@/lib/pipeline/stability";
import { classifyChange, categoryToEnum } from "@/lib/pipeline/classify";
import { maybeNotify } from "@/lib/pipeline/notify";

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;

  const site = await db.site.findUnique({ where: { id: siteId } });
  if (!site || !site.isActive) {
    return NextResponse.json({ error: "Site not found or inactive" }, { status: 404 });
  }

  // Update lastCheckedAt immediately to prevent double-fire
  await db.site.update({ where: { id: siteId }, data: { lastCheckedAt: new Date() } });

  let fetchResult;
  try {
    fetchResult = await fetchSite(site.url, site.renderMode);
  } catch (err) {
    return NextResponse.json({ error: `Fetch failed: ${String(err)}` }, { status: 500 });
  }

  const cleanText = extractContent(fetchResult.html, site.contentSelector, site.stripPatterns);
  const newHash = sha256(cleanText);
  // Prisma v7 expects Uint8Array — convert Buffer
  const htmlGz = new Uint8Array(gzip(fetchResult.html));
  const textGz = new Uint8Array(gzip(cleanText));

  // Get previous snapshot
  const prevSnapshot = await db.snapshot.findFirst({
    where: { siteId },
    orderBy: { fetchedAt: "desc" },
  });

  // Store new snapshot
  const newSnapshot = await db.snapshot.create({
    data: {
      siteId,
      contentHash: newHash,
      htmlGz,
      textGz,
      httpStatus: fetchResult.status,
    },
  });

  // No previous snapshot — first run
  if (!prevSnapshot) {
    return NextResponse.json({ status: "baseline", snapshotId: newSnapshot.id });
  }

  // Hash unchanged
  if (prevSnapshot.contentHash === newHash) {
    return NextResponse.json({ status: "unchanged" });
  }

  // Compute diff
  const prevText = prevSnapshot.textGz
    ? gunzipSync(Buffer.from(prevSnapshot.textGz)).toString("utf8")
    : "";

  const diffResult = computeDiff(prevText, cleanText);

  // Pre-LLM filter: too small to matter
  if (!diffResult.isSignificant) {
    return NextResponse.json({ status: "insignificant_diff" });
  }

  // Stability window — require two consecutive polls with same hash
  const stability = await checkStability(siteId, newHash, diffResult.unified);

  if (stability === "pending") {
    return NextResponse.json({ status: "pending_stability_check" });
  }

  // Confirmed change — classify
  let classification;
  try {
    classification = await classifyChange(
      site.name,
      site.url,
      diffResult.addedLines,
      diffResult.removedLines
    );
  } catch {
    // Classify failed — store as UNKNOWN
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

  return NextResponse.json({ status: "change_detected", changeId: change.id, classification });
}
