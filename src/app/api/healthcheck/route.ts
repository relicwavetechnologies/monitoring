import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Public healthcheck. Returns 200 only when:
 *   - the DB is reachable (cheap "SELECT 1")
 *   - core env vars are set
 *
 * Used by docker-compose's healthcheck and by external uptime monitors.
 * Public on purpose — no PII leaked.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail" | "missing"> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "fail";
  }

  checks.databaseUrl = process.env.DATABASE_URL ? "ok" : "missing";
  checks.cronSecret = process.env.CRON_SECRET ? "ok" : "missing";

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
