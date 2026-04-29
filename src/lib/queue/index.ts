/**
 * pg-boss singleton (v12). Lazy-init so the SDK doesn't try to connect
 * during `next build` (which has no DATABASE_URL).
 *
 * Architecture: Phase 5 runs the queue in-process inside the Next.js
 * server; every Next.js instance is also a worker. pg-boss uses
 * Postgres row-level locking so two workers never double-process the
 * same job — safe to scale out horizontally later.
 */
import { PgBoss } from "pg-boss";
import { getLogger } from "@/lib/logger";
import {
  QUEUES,
  RETENTION,
  RETRY_POLICY,
  type UrlPollPayload,
  type EmailSendPayload,
} from "./jobs";

const log = getLogger("queue");

let _boss: PgBoss | null = null;
let _starting: Promise<PgBoss> | null = null;

function buildBoss(): PgBoss {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for pg-boss");
  }
  // pg-boss v12's typed ConstructorOptions doesn't expose `connectionString`
  // even though the runtime extends pg.PoolConfig (which does). Cast through
  // unknown for the constructor call only.
  const opts = {
    connectionString: url,
    schema: "pgboss",
  } as unknown as ConstructorParameters<typeof PgBoss>[0];
  return new PgBoss(opts);
}

/** Get the boss, starting it on first call. Concurrent callers share the
 *  same in-flight start promise. */
export async function getBoss(): Promise<PgBoss> {
  if (_boss) return _boss;
  if (_starting) return _starting;

  _starting = (async () => {
    const boss = buildBoss();
    boss.on("error", (err: unknown) => log.error({ err }, "pg-boss internal error"));
    await boss.start();
    log.info("pg-boss started");
    _boss = boss;
    _starting = null;
    return boss;
  })();

  return _starting;
}

/** v12 requires queues to exist before send/work. Idempotent. */
export async function ensureQueue(name: string): Promise<void> {
  const boss = await getBoss();
  try {
    await boss.createQueue(name, {
      retentionSeconds: RETENTION.FAILED,
      deleteAfterSeconds: RETENTION.COMPLETED,
    });
  } catch (err) {
    // already exists is fine; anything else is real.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) throw err;
  }
}

// ── Typed publishers ────────────────────────────────────────────────────────

export async function enqueueUrlPoll(payload: UrlPollPayload): Promise<string | null> {
  const boss = await getBoss();
  await ensureQueue(QUEUES.URL_POLL);
  // singletonKey ensures pg-boss won't accept a second URL_POLL for the same
  // monitoredUrlId while one is still queued — re-running the cron tick mid-poll
  // does NOT double-enqueue.
  return boss.send(QUEUES.URL_POLL, payload as unknown as object, {
    ...RETRY_POLICY[QUEUES.URL_POLL],
    singletonKey: payload.monitoredUrlId,
    // Hold for 1 hour: if a duplicate enqueue arrives while one is already
    // queued, it's silently dropped during this window.
    singletonSeconds: 60 * 60,
  });
}

export async function enqueueEmailSend(payload: EmailSendPayload): Promise<string | null> {
  const boss = await getBoss();
  await ensureQueue(QUEUES.EMAIL_SEND);
  return boss.send(QUEUES.EMAIL_SEND, payload as unknown as object, {
    ...RETRY_POLICY[QUEUES.EMAIL_SEND],
    singletonKey: payload.changeId,
    singletonSeconds: 60 * 60,
  });
}

// ── Inspection helpers (used by the admin endpoint) ─────────────────────────

export async function queueDepth(): Promise<Record<string, number>> {
  const boss = await getBoss();
  const out: Record<string, number> = {};
  for (const name of Object.values(QUEUES)) {
    try {
      const stats = await boss.getQueueStats(name);
      out[name] = (stats?.queuedCount ?? 0) + (stats?.activeCount ?? 0);
    } catch {
      out[name] = -1; // queue not yet created (first start)
    }
  }
  return out;
}
