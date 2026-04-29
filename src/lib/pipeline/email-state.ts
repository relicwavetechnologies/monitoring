/**
 * Pure email-delivery state machine — testable without a database.
 *
 * Two pieces:
 *   - `decideEmailNextState`: given the change's severity/confidence and the
 *     site's thresholds, decide whether to try sending or skip.
 *   - `nextRetryAfter`: given how many retries have been attempted, decide
 *     when the sweep job should next try this row. Exponential backoff
 *     bounded at 6 hours.
 */

export interface EmailDecisionInput {
  severity: number;
  confidence: number;
  severityThreshold: number;
  confidenceThreshold: number;
}

export function decideEmailNextState(input: EmailDecisionInput): "send" | "skip" {
  const passes =
    input.severity >= input.severityThreshold && input.confidence >= input.confidenceThreshold;
  return passes ? "send" : "skip";
}

export const MAX_EMAIL_ATTEMPTS = 5;

/**
 * Exponential backoff (in minutes): 5, 15, 60, 240, 360, capped.
 * The sweep job runs every 15 minutes, so the smallest gap is honoured by
 * the scheduler, not by sleeping.
 */
const RETRY_DELAYS_MIN = [5, 15, 60, 240, 360];

export function nextRetryAfter(attempts: number): Date | null {
  if (attempts >= MAX_EMAIL_ATTEMPTS) return null;
  const idx = Math.min(attempts, RETRY_DELAYS_MIN.length - 1);
  const delayMs = RETRY_DELAYS_MIN[idx] * 60 * 1000;
  return new Date(Date.now() + delayMs);
}

export function isReadyForRetry(input: {
  attempts: number;
  lastEmailAttemptAt: Date | null;
  now: Date;
}): boolean {
  if (input.attempts >= MAX_EMAIL_ATTEMPTS) return false;
  if (!input.lastEmailAttemptAt) return true;
  const idx = Math.min(input.attempts, RETRY_DELAYS_MIN.length - 1);
  const delayMs = RETRY_DELAYS_MIN[idx] * 60 * 1000;
  return input.now.getTime() - input.lastEmailAttemptAt.getTime() >= delayMs;
}
