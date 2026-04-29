/**
 * Job handlers. Each handler is a thin shim over an existing pipeline
 * function — the queue is just the *transport* and *retry* layer.
 *
 * Registered against the boss singleton in setup.ts at server boot.
 * pg-boss v12 hands every handler an array of jobs (batched per worker
 * fetch); we iterate even when the batch is size 1.
 */
import type { PgBoss, Job } from "pg-boss";
import { runPoll } from "@/lib/pipeline/run-poll";
import { sendOnce } from "@/lib/pipeline/notify";
import { runEmailSweep } from "@/lib/pipeline/email-sweep";
import { isMonitoredUrlDue } from "@/lib/pipeline/tick-logic";
import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import {
  QUEUES,
  type UrlPollPayload,
  type EmailSendPayload,
} from "./jobs";
import { ensureQueue, enqueueUrlPoll } from "./index";

const log = getLogger("queue.handlers");

export async function registerAllHandlers(boss: PgBoss): Promise<void> {
  // v12: queues must exist before .work() can be called.
  for (const name of Object.values(QUEUES)) await ensureQueue(name);

  await boss.work<UrlPollPayload>(
    QUEUES.URL_POLL,
    { localConcurrency: 8 },
    handleUrlPoll
  );
  await boss.work<EmailSendPayload>(
    QUEUES.EMAIL_SEND,
    { localConcurrency: 4 },
    handleEmailSend
  );
  await boss.work<Record<string, never>>(QUEUES.EMAIL_SWEEP, handleEmailSweep);
  await boss.work<Record<string, never>>(QUEUES.TICK_SCAN, handleTickScan);
}

async function handleUrlPoll(jobs: Job<UrlPollPayload>[]): Promise<void> {
  for (const job of jobs) {
    const hlog = log.child({ jobId: job.id, monitoredUrlId: job.data.monitoredUrlId });
    try {
      const result = await runPoll(job.data.monitoredUrlId);
      hlog.info({ status: result.status }, "url.poll completed");
    } catch (err) {
      hlog.error({ err }, "url.poll handler threw");
      throw err; // pg-boss will record and retry per RETRY_POLICY
    }
  }
}

async function handleEmailSend(jobs: Job<EmailSendPayload>[]): Promise<void> {
  for (const job of jobs) {
    const hlog = log.child({
      jobId: job.id,
      changeId: job.data.changeId,
      isRetry: job.data.isRetry,
    });
    try {
      const outcome = await sendOnce(job.data.changeId);
      hlog.info({ outcome }, "email.send completed");
      if (outcome === "failed") {
        // Throw so pg-boss schedules a retry. After RETRY_POLICY.retryLimit,
        // the email-sweep job will pick up FAILED rows again on its own
        // schedule — belt-and-braces.
        throw new Error("email send returned 'failed'");
      }
    } catch (err) {
      hlog.error({ err }, "email.send handler threw");
      throw err;
    }
  }
}

async function handleEmailSweep(): Promise<void> {
  log.info("email.sweep starting");
  const result = await runEmailSweep();
  log.info(result, "email.sweep complete");
}

async function handleTickScan(): Promise<void> {
  const now = new Date();
  const safetyCutoff = new Date(now.getTime() - 60_000);

  const candidates = await db.monitoredUrl.findMany({
    where: {
      paused: false,
      site: { isActive: true },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: safetyCutoff } }],
    },
    select: {
      id: true,
      lastCheckedAt: true,
      site: { select: { pollIntervalMin: true } },
    },
  });

  const due = candidates.filter((u) =>
    isMonitoredUrlDue({
      now,
      lastCheckedAt: u.lastCheckedAt,
      pollIntervalMin: u.site.pollIntervalMin,
    })
  );

  for (const u of due) {
    await enqueueUrlPoll({ monitoredUrlId: u.id, enqueuedAt: now.toISOString() });
  }

  log.info({ candidates: candidates.length, due: due.length }, "tick.scan complete");
}
