import { NextRequest, NextResponse } from "next/server";
import { runPoll } from "@/lib/pipeline/run-poll";

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  if (!verifyCron(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await params;

  const result = await runPoll(siteId);

  if (result.status === "not_found")
    return NextResponse.json({ error: "Site not found or inactive" }, { status: 404 });

  if (result.status === "fetch_failed")
    return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(result);
}
