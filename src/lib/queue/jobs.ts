/**
 * Typed job names + payload shapes.
 *
 * Pure module: declares the contract between publishers and handlers but
 * does no I/O of its own. Handler code in handlers.ts and publisher code
 * in index.ts both import from here so the wire format stays in sync.
 */

export const QUEUES = {
  /** Per-MonitoredUrl polling job. Singleton-keyed by monitoredUrlId so two
   *  enqueues for the same URL never run concurrently — even across multiple
   *  worker processes once we scale out. */
  URL_POLL: "url.poll",
  /** Per-Change email delivery. Decoupled from the poll so a slow email
   *  provider doesn't block the pipeline. */
  EMAIL_SEND: "email.send",
  /** Periodic retry sweep for FAILED emails. */
  EMAIL_SWEEP: "email.sweep",
  /** Periodic tick: enumerates due MonitoredUrls and fans out URL_POLL. */
  TICK_SCAN: "tick.scan",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface UrlPollPayload {
  monitoredUrlId: string;
  /** When this job was originally enqueued (ISO). Used for staleness checks. */
  enqueuedAt: string;
}

export interface EmailSendPayload {
  changeId: string;
  /** True if this enqueue came from the retry sweep, false for the initial
   *  send right after a Change was created. Affects logging only. */
  isRetry: boolean;
}

// EMAIL_SWEEP and TICK_SCAN take no payload.
export type EmailSweepPayload = Record<string, never>;
export type TickScanPayload = Record<string, never>;

/** Per-job retry policy. pg-boss accepts these as job options. */
export const RETRY_POLICY = {
  [QUEUES.URL_POLL]:    { retryLimit: 3, retryDelay: 60,  retryBackoff: true }, // 1m → 5m → 30m
  [QUEUES.EMAIL_SEND]:  { retryLimit: 3, retryDelay: 60,  retryBackoff: true },
  [QUEUES.EMAIL_SWEEP]: { retryLimit: 0 },                                       // sweep itself shouldn't retry
  [QUEUES.TICK_SCAN]:   { retryLimit: 0 },                                       // tick is idempotent and runs again every 5min
} as const;

/** How long the queue keeps a completed job around before pruning (seconds). */
export const RETENTION = {
  COMPLETED: 60 * 60 * 24 * 7,   // 7 days
  FAILED:    60 * 60 * 24 * 30,  // 30 days — failed jobs need investigation
} as const;
