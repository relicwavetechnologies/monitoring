/**
 * Pure cron-tick decisions — testable without a database.
 *
 * Phase 2b tick iterates MonitoredUrls. A URL is "due" if:
 *   - it has never been checked, or
 *   - the configured per-site interval has elapsed since the last check.
 *
 * The pure function takes the bare data the DB query selects so the tick
 * route can stay a thin shell over `db.monitoredUrl.findMany`.
 */

export interface DueCandidate {
  lastCheckedAt: Date | null;
  pollIntervalMin: number;
}

export function isMonitoredUrlDue(input: { now: Date } & DueCandidate): boolean {
  if (!input.lastCheckedAt) return true;
  const intervalMs = Math.max(0, input.pollIntervalMin) * 60 * 1000;
  return input.now.getTime() - input.lastCheckedAt.getTime() >= intervalMs;
}
