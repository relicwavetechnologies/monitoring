import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { snapshot, toPrometheusText } from "@/lib/metrics";
import { db } from "@/lib/db";
import { queueDepth } from "@/lib/queue";

/**
 * Phase 6 admin metrics endpoint. Returns either Prometheus text format
 * (Accept: text/plain) or JSON (default), with:
 *   - process counters (in-memory, reset on restart)
 *   - queue depths (live, from pg-boss)
 *   - DB rollups (total snapshots, changes, by-status counts)
 *   - cost rollup (LLM cost over the last 7 days)
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accept = req.headers.get("accept") ?? "";
  const wantsProm = accept.includes("text/plain");

  const snap = snapshot();
  let qDepth: Record<string, number> = {};
  try {
    qDepth = await queueDepth();
  } catch {
    qDepth = {};
  }

  // DB rollups, cheap aggregate queries.
  const [siteCount, urlCount, snapshotCount, changeCount, sevDist, costSum] = await Promise.all([
    db.site.count({ where: { isActive: true } }),
    db.monitoredUrl.count({ where: { paused: false } }),
    db.snapshot.count(),
    db.change.count(),
    db.change.groupBy({ by: ["severity"], _count: { id: true } }),
    db.change.aggregate({
      where: { detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _sum: { classifierCostUsd: true, classifierTokensIn: true, classifierTokensOut: true },
      _count: { id: true },
    }),
  ]);

  const last7d = {
    changes: costSum._count.id,
    costUsd: costSum._sum.classifierCostUsd ?? 0,
    tokensIn: costSum._sum.classifierTokensIn ?? 0,
    tokensOut: costSum._sum.classifierTokensOut ?? 0,
  };

  const json = {
    uptimeSeconds: snap.uptimeSeconds,
    counters: snap.counters,
    queueDepth: qDepth,
    db: {
      activeSites: siteCount,
      activeMonitoredUrls: urlCount,
      totalSnapshots: snapshotCount,
      totalChanges: changeCount,
      severityDistribution: sevDist.map((d) => ({ severity: d.severity, count: d._count.id })),
    },
    last7d,
  };

  if (wantsProm) {
    let text = toPrometheusText();
    text += `# HELP visawatch_active_sites Active Site rows\n# TYPE visawatch_active_sites gauge\nvisawatch_active_sites ${siteCount}\n`;
    text += `# HELP visawatch_active_monitored_urls Active MonitoredUrl rows\n# TYPE visawatch_active_monitored_urls gauge\nvisawatch_active_monitored_urls ${urlCount}\n`;
    text += `# HELP visawatch_snapshots_total Total Snapshot rows\n# TYPE visawatch_snapshots_total counter\nvisawatch_snapshots_total ${snapshotCount}\n`;
    text += `# HELP visawatch_changes_total Total Change rows\n# TYPE visawatch_changes_total counter\nvisawatch_changes_total ${changeCount}\n`;
    for (const d of sevDist) {
      text += `visawatch_changes_by_severity{severity="${d.severity}"} ${d._count.id}\n`;
    }
    for (const [name, depth] of Object.entries(qDepth)) {
      text += `visawatch_queue_depth{queue="${name}"} ${depth}\n`;
    }
    text += `visawatch_llm_cost_usd_last7d ${last7d.costUsd}\n`;
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; version=0.0.4" },
    });
  }

  return NextResponse.json(json);
}
