import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queueDepth, getBoss } from "@/lib/queue";
import { QUEUES } from "@/lib/queue/jobs";
import { getLogger } from "@/lib/logger";

const log = getLogger("api.admin.queue");

/**
 * Admin queue inspection endpoint. Reports per-queue depth + queue
 * stats (deferred / queued / active / total counts) so the dashboard
 * can show DLQ pressure. Auth-gated to logged-in users; in Phase 8
 * this should be tightened to an admin-only role.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const depth = await queueDepth();
    const boss = await getBoss();
    const stats: Record<string, unknown> = {};
    for (const name of Object.values(QUEUES)) {
      try {
        stats[name] = await boss.getQueueStats(name);
      } catch {
        stats[name] = null;
      }
    }
    return NextResponse.json({ depth, stats });
  } catch (err) {
    log.error({ err }, "admin queue inspection failed");
    return NextResponse.json({ error: "queue unavailable" }, { status: 503 });
  }
}
