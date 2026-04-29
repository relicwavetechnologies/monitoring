import { NextRequest, NextResponse } from "next/server";
import { runEmailSweep } from "@/lib/pipeline/email-sweep";
import { getLogger } from "@/lib/logger";

const log = getLogger("api.cron.email-sweep");

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runEmailSweep();
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err }, "email sweep crashed");
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
