/**
 * Pure tier-escalation logic — testable without a database.
 *
 * After a fetch, we feed (current fetchMode, the outcome, the URL's
 * failure history, the URL's escalation policy) into `decideNextTier`.
 * The output describes both the persistence side-effects (what to write
 * back to MonitoredUrl) and the new fetchMode that should be used on the
 * next poll.
 */

export type FetchMode = "STATIC" | "PLAYWRIGHT" | "STEALTH" | "EXTERNAL";
export type FailureKind = "NETWORK" | "BLOCKED" | "TIMEOUT" | "PARSE" | "OTHER";

const TIER_ORDER: FetchMode[] = ["STATIC", "PLAYWRIGHT", "STEALTH", "EXTERNAL"];

/** What the next tier would be after the given one. NULL means we're already
 *  at the top of the ladder and there's nowhere left to escalate to. */
export function nextTier(current: FetchMode): FetchMode | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx === -1 || idx === TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export interface EscalationInput {
  currentMode: FetchMode;
  consecutiveFailures: number;
  outcomeKind: "OK" | FailureKind;
  autoEscalate: boolean;
  escalateAfter: number;
}

export interface EscalationOutput {
  /** What fetchMode to use going forward. */
  newMode: FetchMode;
  /** What consecutiveFailures should be after this poll. */
  newConsecutiveFailures: number;
  /** Whether the persistence layer should write `lastFailureAt: now`. */
  recordFailureNow: boolean;
  /** What lastFailureKind should be set to (NULL clears it on success). */
  newFailureKind: FailureKind | null;
  /** True if the tier was bumped — useful for logging and dashboard signals. */
  escalated: boolean;
}

/**
 * Apply one poll's outcome to the URL's tier state.
 *
 *   - Success → reset failure counter, clear lastFailureKind, leave mode untouched.
 *   - Non-blocking failure (NETWORK / TIMEOUT / PARSE / OTHER) → bump
 *     counter, record kind, but do NOT escalate. These usually mean the
 *     site is genuinely down or returned junk; switching to a heavier
 *     fetcher won't help and will just burn cost.
 *   - BLOCKED → bump counter, record kind. If the counter reaches the
 *     URL's threshold AND auto-escalate is enabled AND there's a higher
 *     tier available, escalate and reset the counter.
 */
export function decideNextTier(input: EscalationInput): EscalationOutput {
  if (input.outcomeKind === "OK") {
    return {
      newMode: input.currentMode,
      newConsecutiveFailures: 0,
      recordFailureNow: false,
      newFailureKind: null,
      escalated: false,
    };
  }

  const nextFailureCount = input.consecutiveFailures + 1;

  if (input.outcomeKind !== "BLOCKED") {
    return {
      newMode: input.currentMode,
      newConsecutiveFailures: nextFailureCount,
      recordFailureNow: true,
      newFailureKind: input.outcomeKind,
      escalated: false,
    };
  }

  // BLOCKED — consider escalation.
  const target = nextTier(input.currentMode);
  const shouldEscalate =
    input.autoEscalate &&
    target !== null &&
    nextFailureCount >= Math.max(1, input.escalateAfter);

  if (shouldEscalate) {
    return {
      newMode: target!,
      // Reset the counter so the new tier has a fresh budget before any
      // further escalation. If it also gets blocked we'll count up to the
      // threshold again and try the next tier, eventually reaching EXTERNAL.
      newConsecutiveFailures: 0,
      recordFailureNow: true,
      newFailureKind: "BLOCKED",
      escalated: true,
    };
  }

  return {
    newMode: input.currentMode,
    newConsecutiveFailures: nextFailureCount,
    recordFailureNow: true,
    newFailureKind: "BLOCKED",
    escalated: false,
  };
}
