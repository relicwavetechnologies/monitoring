import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runPoll } from "@/lib/pipeline/run-poll";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await runPoll(id);

  if (result.status === "not_found")
    return NextResponse.json({ status: "not_found", error: "Site not found or inactive" }, { status: 404 });

  if (result.status === "fetch_failed")
    return NextResponse.json({ status: "fetch_failed", error: result.error }, { status: 500 });

  return NextResponse.json(result);
}
