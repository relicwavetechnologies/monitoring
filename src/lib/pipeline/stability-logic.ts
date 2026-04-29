/**
 * Pure stability state machine — testable without a database.
 *
 * The previous implementation confirmed a change after seeing the same hash on
 * two consecutive polls. With the default 60-min poll interval that meant
 * "two hours", not the "two days" the public docs implied, and a flapping site
 * could leave a pending entry in the DB indefinitely.
 *
 * The new model is time-based: when a new hash is first seen we record it as
 * pending with `firstSeenAt`. Subsequent polls update `lastSeenAt`. The change
 * is confirmed only when the same hash is still seen *after* the configurable
 * window elapses (`Site.confirmAfterHours`). If the hash changes mid-window,
 * pending is reset to the new hash. This logic does no I/O.
 */

export interface PendingDiff {
  hash: string;
  diffText: string;
  firstSeenAt: string;
  // Field added in Phase 1; older rows that lack it are treated as
  // lastSeenAt = firstSeenAt for backwards compatibility.
  lastSeenAt?: string;
}

export type StabilityVerdict =
  /** First time we've seen this hash. Persist as pending. */
  | { decision: "pending_first_sight"; pending: PendingDiff }
  /** Same hash as pending, but the confirm window hasn't elapsed yet. */
  | { decision: "pending_within_window"; pending: PendingDiff; etaHours: number }
  /** Same hash as pending and the window has elapsed. Clear pending; classify. */
  | { decision: "confirmed"; clearPending: true }
  /** Hash changed mid-window. Reset pending to the new hash. */
  | { decision: "pending_reset"; pending: PendingDiff };

export interface StabilityInput {
  pendingDiff: PendingDiff | null;
  newHash: string;
  newDiffText: string;
  now: Date;
  confirmAfterHours: number;
}

export function nextStabilityState(input: StabilityInput): StabilityVerdict {
  const { pendingDiff, newHash, newDiffText, now, confirmAfterHours } = input;
  const nowIso = now.toISOString();

  if (!pendingDiff) {
    return {
      decision: "pending_first_sight",
      pending: { hash: newHash, diffText: newDiffText, firstSeenAt: nowIso, lastSeenAt: nowIso },
    };
  }

  if (pendingDiff.hash !== newHash) {
    return {
      decision: "pending_reset",
      pending: { hash: newHash, diffText: newDiffText, firstSeenAt: nowIso, lastSeenAt: nowIso },
    };
  }

  // Same hash as pending. Has the confirm window elapsed?
  const firstSeenMs = Date.parse(pendingDiff.firstSeenAt);
  const elapsedMs = now.getTime() - firstSeenMs;
  const windowMs = Math.max(0, confirmAfterHours) * 60 * 60 * 1000;

  if (elapsedMs >= windowMs) {
    return { decision: "confirmed", clearPending: true };
  }

  const etaMs = windowMs - elapsedMs;
  return {
    decision: "pending_within_window",
    pending: { ...pendingDiff, lastSeenAt: nowIso },
    etaHours: etaMs / (60 * 60 * 1000),
  };
}
