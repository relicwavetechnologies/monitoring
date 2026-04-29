import { describe, it, expect } from "vitest";
import {
  decideEmailNextState,
  isReadyForRetry,
  nextRetryAfter,
  MAX_EMAIL_ATTEMPTS,
} from "@/lib/pipeline/email-state";

describe("decideEmailNextState", () => {
  it("sends when both severity and confidence meet the per-site thresholds", () => {
    expect(
      decideEmailNextState({
        severity: 4,
        confidence: 0.8,
        severityThreshold: 3,
        confidenceThreshold: 0.7,
      })
    ).toBe("send");
  });

  it("skips when severity is below threshold", () => {
    expect(
      decideEmailNextState({
        severity: 2,
        confidence: 0.95,
        severityThreshold: 3,
        confidenceThreshold: 0.7,
      })
    ).toBe("skip");
  });

  it("skips when confidence is below threshold", () => {
    expect(
      decideEmailNextState({
        severity: 5,
        confidence: 0.3,
        severityThreshold: 3,
        confidenceThreshold: 0.7,
      })
    ).toBe("skip");
  });

  it("respects per-site overrides — a chatty site can require severity 5", () => {
    expect(
      decideEmailNextState({
        severity: 4,
        confidence: 0.99,
        severityThreshold: 5,
        confidenceThreshold: 0.7,
      })
    ).toBe("skip");
  });

  it("uses inclusive comparison on threshold edges", () => {
    expect(
      decideEmailNextState({
        severity: 3,
        confidence: 0.7,
        severityThreshold: 3,
        confidenceThreshold: 0.7,
      })
    ).toBe("send");
  });
});

describe("nextRetryAfter / isReadyForRetry", () => {
  it("returns null after the attempt cap so the row gets parked", () => {
    expect(nextRetryAfter(MAX_EMAIL_ATTEMPTS)).toBeNull();
    expect(nextRetryAfter(MAX_EMAIL_ATTEMPTS + 5)).toBeNull();
  });

  it("schedules the first retry only minutes out", () => {
    const at = nextRetryAfter(0);
    expect(at).toBeInstanceOf(Date);
    const delayMs = at!.getTime() - Date.now();
    // 5 minutes ± a bit of test latency
    expect(delayMs).toBeGreaterThan(4 * 60_000);
    expect(delayMs).toBeLessThan(6 * 60_000);
  });

  it("is ready for retry immediately when there has been no prior attempt", () => {
    expect(
      isReadyForRetry({
        attempts: 0,
        lastEmailAttemptAt: null,
        now: new Date(),
      })
    ).toBe(true);
  });

  it("waits out the backoff window between attempts", () => {
    const lastAttempt = new Date("2026-04-29T10:00:00Z");
    // Backoff for attempts=1 is 15 minutes.
    const tooSoon = new Date("2026-04-29T10:10:00Z");
    const longEnough = new Date("2026-04-29T10:20:00Z");

    expect(
      isReadyForRetry({ attempts: 1, lastEmailAttemptAt: lastAttempt, now: tooSoon })
    ).toBe(false);
    expect(
      isReadyForRetry({ attempts: 1, lastEmailAttemptAt: lastAttempt, now: longEnough })
    ).toBe(true);
  });

  it("never reports ready when attempts have hit the cap", () => {
    expect(
      isReadyForRetry({
        attempts: MAX_EMAIL_ATTEMPTS,
        lastEmailAttemptAt: new Date(0),
        now: new Date(),
      })
    ).toBe(false);
  });
});
