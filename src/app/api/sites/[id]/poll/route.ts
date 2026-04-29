import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runPollForSite } from "@/lib/pipeline/run-poll";

/**
 * Manually re-poll a Site. Phase 2b: this fans out to every active
 * MonitoredUrl underneath the Site and returns one result per URL.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const results = await runPollForSite(id);

  return NextResponse.json({
    siteId: id,
    polled: results.length,
    results,
  });
}
