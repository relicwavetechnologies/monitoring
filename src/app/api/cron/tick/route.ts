import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { isMonitoredUrlDue } from "@/lib/pipeline/tick-logic";
import { enqueueUrlPoll } from "@/lib/queue";

const log = getLogger("api.cron.tick");

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Phase 5: tick now ENQUEUES url.poll jobs onto pg-boss instead of
 * fanning out HTTP requests in-process. The queue handler picks them
 * up, retries on failure, and enforces per-URL singleton concurrency.
 *
 * This route stays in place as a manual trigger for debugging; the
 * primary scheduler is pg-boss's own internal cron (every 5 minutes,
 * registered in queue/setup.ts).
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const safetyCutoff = new Date(now.getTime() - 60_000);

  const candidates = await db.monitoredUrl.findMany({
    where: {
      paused: false,
      site: { isActive: true },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: safetyCutoff } }],
    },
    select: {
      id: true,
      lastCheckedAt: true,
      site: { select: { id: true, pollIntervalMin: true } },
    },
  });

  const due = candidates.filter((u) =>
    isMonitoredUrlDue({
      now,
      lastCheckedAt: u.lastCheckedAt,
      pollIntervalMin: u.site.pollIntervalMin,
    })
  );

  let enqueued = 0;
  for (const u of due) {
    try {
      await enqueueUrlPoll({ monitoredUrlId: u.id, enqueuedAt: now.toISOString() });
      enqueued++;
    } catch (err) {
      log.error({ err, monitoredUrlId: u.id }, "failed to enqueue url.poll");
    }
  }

  log.info({ candidates: candidates.length, due: due.length, enqueued }, "tick fan-out complete");

  return NextResponse.json({
    candidates: candidates.length,
    due: due.length,
    enqueued,
  });
}
