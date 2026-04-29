import { describe, it, expect } from "vitest";
import { nextStabilityState, type PendingDiff } from "@/lib/pipeline/stability-logic";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const DIFF = "+ new line\n- old line";

function at(hours: number): Date {
  return new Date(Date.UTC(2026, 3, 29, hours, 0, 0));
}

describe("nextStabilityState", () => {
  it("returns pending_first_sight when there is no prior pending diff", () => {
    const verdict = nextStabilityState({
      pendingDiff: null,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(10),
      confirmAfterHours: 24,
    });
    expect(verdict.decision).toBe("pending_first_sight");
    if (verdict.decision === "pending_first_sight") {
      expect(verdict.pending.hash).toBe(HASH_A);
      expect(verdict.pending.firstSeenAt).toBe(at(10).toISOString());
      expect(verdict.pending.lastSeenAt).toBe(at(10).toISOString());
    }
  });

  it("stays pending when the same hash is seen inside the confirm window", () => {
    const pending: PendingDiff = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(10).toISOString(),
      lastSeenAt: at(10).toISOString(),
    };
    const verdict = nextStabilityState({
      pendingDiff: pending,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(20), // 10h elapsed, window is 24h
      confirmAfterHours: 24,
    });
    expect(verdict.decision).toBe("pending_within_window");
    if (verdict.decision === "pending_within_window") {
      expect(verdict.etaHours).toBeCloseTo(14, 5);
      expect(verdict.pending.firstSeenAt).toBe(pending.firstSeenAt);
      expect(verdict.pending.lastSeenAt).toBe(at(20).toISOString());
    }
  });

  it("confirms when the same hash persists past the confirm window", () => {
    const pending: PendingDiff = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(10).toISOString(),
      lastSeenAt: at(10).toISOString(),
    };
    const verdict = nextStabilityState({
      pendingDiff: pending,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(34), // 24h elapsed exactly
      confirmAfterHours: 24,
    });
    expect(verdict.decision).toBe("confirmed");
  });

  it("resets pending when the hash flips mid-window", () => {
    const pending: PendingDiff = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(10).toISOString(),
      lastSeenAt: at(10).toISOString(),
    };
    const verdict = nextStabilityState({
      pendingDiff: pending,
      newHash: HASH_B,
      newDiffText: "different diff",
      now: at(20),
      confirmAfterHours: 24,
    });
    expect(verdict.decision).toBe("pending_reset");
    if (verdict.decision === "pending_reset") {
      expect(verdict.pending.hash).toBe(HASH_B);
      expect(verdict.pending.firstSeenAt).toBe(at(20).toISOString());
    }
  });

  it("treats a zero-hour confirm window as 'confirm immediately'", () => {
    const pending: PendingDiff = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(10).toISOString(),
      lastSeenAt: at(10).toISOString(),
    };
    const verdict = nextStabilityState({
      pendingDiff: pending,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(10),
      confirmAfterHours: 0,
    });
    expect(verdict.decision).toBe("confirmed");
  });

  it("tolerates legacy pending entries without lastSeenAt", () => {
    // Pre-Phase-1 rows only had hash/diffText/firstSeenAt.
    const legacy = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(10).toISOString(),
    } as PendingDiff;
    const verdict = nextStabilityState({
      pendingDiff: legacy,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(40),
      confirmAfterHours: 24,
    });
    expect(verdict.decision).toBe("confirmed");
  });

  it("returns pending_within_window even with a very long window", () => {
    const pending: PendingDiff = {
      hash: HASH_A,
      diffText: DIFF,
      firstSeenAt: at(0).toISOString(),
      lastSeenAt: at(0).toISOString(),
    };
    const verdict = nextStabilityState({
      pendingDiff: pending,
      newHash: HASH_A,
      newDiffText: DIFF,
      now: at(100), // 100h
      confirmAfterHours: 168, // a week
    });
    expect(verdict.decision).toBe("pending_within_window");
  });
});
