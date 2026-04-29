import { db } from "@/lib/db";
import { sendOnce } from "@/lib/pipeline/notify";
import { isReadyForRetry, MAX_EMAIL_ATTEMPTS } from "@/lib/pipeline/email-state";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.email-sweep");

export interface SweepResult {
  scanned: number;
  retried: number;
  succeeded: number;
  giveUp: number;
}

/**
 * Find Change rows whose last email attempt failed and whose backoff has
 * elapsed; retry them. Rows that exceed the attempt cap are flipped to
 * SKIPPED so we stop trying.
 */
export async function runEmailSweep(now: Date = new Date()): Promise<SweepResult> {
  const candidates = await db.change.findMany({
    where: { emailStatus: "FAILED" },
    select: { id: true, emailAttempts: true, lastEmailAttemptAt: true },
    orderBy: { lastEmailAttemptAt: "asc" },
    take: 100,
  });

  const result: SweepResult = { scanned: candidates.length, retried: 0, succeeded: 0, giveUp: 0 };

  for (const c of candidates) {
    if (c.emailAttempts >= MAX_EMAIL_ATTEMPTS) {
      await db.change.update({ where: { id: c.id }, data: { emailStatus: "SKIPPED" } });
      result.giveUp++;
      continue;
    }
    if (!isReadyForRetry({ attempts: c.emailAttempts, lastEmailAttemptAt: c.lastEmailAttemptAt, now })) {
      continue;
    }
    result.retried++;
    const outcome = await sendOnce(c.id);
    if (outcome === "sent") result.succeeded++;
  }

  log.info(result, "email sweep finished");
  return result;
}
