/**
 * Per-Change subscription matching + multi-channel delivery. Replaces
 * the Phase 1 single-recipient email path.
 *
 * For each Change, we find every active Subscription that targets:
 *   - this Change's MonitoredUrl directly, OR
 *   - this Change's parent Site
 * with severity >= subscription.minSeverity (or the site default if NULL).
 * Then we deliver per channel: EMAIL via Resend (sendOnce), SLACK via
 * incoming webhook, WEBHOOK as a generic JSON POST.
 */
import { db } from "@/lib/db";
import { sendOnce } from "@/lib/pipeline/notify";
import { sendSlackAlert } from "@/lib/pipeline/slack";
import { fetch as undiciFetch } from "undici";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.subscriptions");

export interface DeliveryResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function deliverToSubscribers(changeId: string): Promise<DeliveryResult> {
  const change = await db.change.findUnique({
    where: { id: changeId },
    include: { site: true, monitoredUrl: true },
  });
  if (!change) return { attempted: 0, succeeded: 0, failed: 0 };

  if (change.muted || change.acknowledgedAt) {
    log.info({ changeId, muted: change.muted, acked: !!change.acknowledgedAt }, "skipping delivery");
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  if (change.classifierStatus === "UNGROUNDED") {
    log.warn({ changeId }, "skipping subscriber delivery — classification ungrounded");
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  // Find subscriptions matching either this URL or the parent Site.
  const subs = await db.subscription.findMany({
    where: {
      paused: false,
      OR: [
        { monitoredUrlId: change.monitoredUrlId },
        { siteId: change.siteId, monitoredUrlId: null },
      ],
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const result: DeliveryResult = { attempted: 0, succeeded: 0, failed: 0 };
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/changes/${change.id}`;

  for (const sub of subs) {
    const threshold = sub.minSeverity ?? change.site.severityThreshold;
    if (change.severity < threshold) continue;

    result.attempted++;
    try {
      let outcome: "sent" | "failed" = "failed";
      if (sub.channel === "EMAIL") {
        // EMAIL still uses the Phase 1 single sendOnce; the subscriber
        // identity isn't yet plumbed through Resend's "to" field — that's
        // a follow-up. For now any EMAIL subscriber on a site triggers
        // the global alert; refinement comes when we wire per-recipient.
        outcome = await sendOnce(change.id);
      } else if (sub.channel === "SLACK" && sub.webhookUrl) {
        outcome = await sendSlackAlert({
          webhookUrl: sub.webhookUrl,
          siteName: change.site.name,
          siteUrl: change.monitoredUrl.url,
          changeId: change.id,
          severity: change.severity,
          category: change.category,
          summary: change.summary,
          detail: change.detail,
          evidenceQuotes: change.evidenceQuotes,
          dashboardUrl,
        });
      } else if (sub.channel === "WEBHOOK" && sub.webhookUrl) {
        outcome = await postWebhook(sub.webhookUrl, change, dashboardUrl);
      }
      if (outcome === "sent") result.succeeded++;
      else result.failed++;
    } catch (err) {
      log.error({ err, subId: sub.id, changeId }, "delivery threw");
      result.failed++;
    }
  }

  return result;
}

async function postWebhook(
  url: string,
  change: {
    id: string;
    summary: string;
    detail: string | null;
    severity: number;
    category: string;
    evidenceQuotes: string[];
    site: { id: string; name: string };
    monitoredUrl: { id: string; url: string };
  },
  dashboardUrl: string
): Promise<"sent" | "failed"> {
  try {
    const res = await undiciFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changeId: change.id,
        summary: change.summary,
        detail: change.detail,
        severity: change.severity,
        category: change.category,
        evidenceQuotes: change.evidenceQuotes,
        site: change.site,
        monitoredUrl: change.monitoredUrl,
        dashboardUrl,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
