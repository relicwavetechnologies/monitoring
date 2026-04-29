import { NextRequest, NextResponse } from "next/server";
import { runPoll } from "@/lib/pipeline/run-poll";

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Phase 2b: the path param is now a MonitoredUrl id, not a Site id. The
 * folder name `[siteId]` is preserved to keep the URL stable for the
 * crontab wrapper, but the value is treated as a MonitoredUrl id.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  if (!verifyCron(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId: monitoredUrlId } = await params;

  const result = await runPoll(monitoredUrlId);

  if (result.status === "not_found")
    return NextResponse.json({ error: "MonitoredUrl not found" }, { status: 404 });

  if (result.status === "fetch_failed")
    return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(result);
}
