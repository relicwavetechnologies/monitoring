import { sendChangeAlert } from "@/lib/resend";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { decideEmailNextState } from "@/lib/pipeline/email-state";

const log = getLogger("pipeline.notify");

/**
 * Decide whether the change deserves an email and try to send it. Per-site
 * thresholds (severity / confidence) come from the Site row, no longer from
 * hardcoded module constants. Failures bump `emailStatus` to FAILED so the
 * sweep job can retry; successes flip it to SENT and never re-send.
 */
export async function maybeNotify(changeId: string): Promise<void> {
  const change = await db.change.findUnique({
    where: { id: changeId },
    include: { site: true },
  });
  if (!change) return;

  // Already sent or already given up — nothing to do.
  if (change.emailStatus === "SENT" || change.emailStatus === "SKIPPED") return;

  // Phase 3: refuse to email an ungrounded classification. The change is
  // still recorded and visible in the dashboard, but we don't send an
  // alert that we can't back up with quotes from the source.
  if (change.classifierStatus === "UNGROUNDED") {
    log.warn({ changeId, siteId: change.siteId }, "skipping email — classification is ungrounded");
    await db.change.update({
      where: { id: changeId },
      data: { emailStatus: "SKIPPED" },
    });
    return;
  }

  const action = decideEmailNextState({
    severity: change.severity,
    confidence: change.confidence,
    severityThreshold: change.site.severityThreshold,
    confidenceThreshold: change.site.confidenceThreshold,
  });

  if (action === "skip") {
    await db.change.update({
      where: { id: changeId },
      data: { emailStatus: "SKIPPED" },
    });
    return;
  }

  await sendOnce(changeId);
}

/**
 * Attempt one delivery. Caller decides whether to call this (initial send vs.
 * retry sweep). On success: emailStatus=SENT. On failure: emailStatus=FAILED
 * with the error captured; the sweep job picks it up later.
 */
export async function sendOnce(changeId: string): Promise<"sent" | "failed"> {
  const change = await db.change.findUnique({
    where: { id: changeId },
    include: { site: true },
  });
  if (!change) return "failed";
  if (change.emailStatus === "SENT" || change.emailStatus === "SKIPPED") return "sent";

  const snippetLines = change.diffText.split("\n").slice(0, 40).join("\n");

  try {
    await sendChangeAlert({
      siteName: change.site.name,
      siteUrl: change.site.url,
      changeId: change.id,
      severity: change.severity,
      category: change.category,
      summary: change.summary,
      detail: change.detail,
      diffSnippet: snippetLines,
    });
    await db.change.update({
      where: { id: changeId },
      data: {
        emailStatus: "SENT",
        emailAttempts: { increment: 1 },
        lastEmailAttemptAt: new Date(),
        lastEmailError: null,
      },
    });
    log.info({ changeId, siteId: change.siteId }, "alert email sent");
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.change.update({
      where: { id: changeId },
      data: {
        emailStatus: "FAILED",
        emailAttempts: { increment: 1 },
        lastEmailAttemptAt: new Date(),
        lastEmailError: message.slice(0, 2_000),
      },
    });
    log.error({ err, changeId, siteId: change.siteId }, "alert email failed");
    return "failed";
  }
}
