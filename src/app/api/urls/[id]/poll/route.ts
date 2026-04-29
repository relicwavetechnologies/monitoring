import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runPoll } from "@/lib/pipeline/run-poll";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await runPoll(id);

  if (result.status === "not_found")
    return NextResponse.json(result, { status: 404 });
  if (result.status === "fetch_failed")
    return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
