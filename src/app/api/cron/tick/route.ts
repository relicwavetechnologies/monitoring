import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { isMonitoredUrlDue } from "@/lib/pipeline/tick-logic";

const log = getLogger("api.cron.tick");

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Phase 2b: tick now iterates MonitoredUrls, not Sites. The cadence still
 * comes from `Site.pollIntervalMin` (URLs on the same site share a cadence;
 * per-URL cadence override can come in a later phase). A URL is "due" if
 * its own `lastCheckedAt` is older than that interval.
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const safetyCutoff = new Date(now.getTime() - 1 * 60 * 1000);

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

  const baseUrl = req.nextUrl.origin;
  const settled = await Promise.allSettled(
    due.map((u) =>
      fetch(`${baseUrl}/api/cron/poll/${u.id}`, {
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    )
  );

  const failures = settled.filter((s) => s.status === "rejected").length;
  log.info({ triggered: due.length, failures }, "tick fan-out complete");

  return NextResponse.json({
    triggered: due.length,
    failures,
    monitoredUrlIds: due.map((u) => u.id),
  });
}
