import { describe, it, expect } from "vitest";
import { decideNextTier, nextTier } from "@/lib/pipeline/fetchers/tier-escalation";

describe("nextTier", () => {
  it("walks the ladder STATIC → PLAYWRIGHT → STEALTH → CAMOUFOX → EXTERNAL", () => {
    expect(nextTier("STATIC")).toBe("PLAYWRIGHT");
    expect(nextTier("PLAYWRIGHT")).toBe("STEALTH");
    expect(nextTier("STEALTH")).toBe("CAMOUFOX");
    expect(nextTier("CAMOUFOX")).toBe("EXTERNAL");
  });

  it("returns null at the top of the ladder", () => {
    expect(nextTier("EXTERNAL")).toBeNull();
  });
});

describe("decideNextTier", () => {
  it("resets the failure counter on success", () => {
    const r = decideNextTier({
      currentMode: "PLAYWRIGHT",
      consecutiveFailures: 2,
      outcomeKind: "OK",
      autoEscalate: true,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("PLAYWRIGHT");
    expect(r.newConsecutiveFailures).toBe(0);
    expect(r.recordFailureNow).toBe(false);
    expect(r.newFailureKind).toBeNull();
    expect(r.escalated).toBe(false);
  });

  it("does NOT escalate on a NETWORK failure no matter how many", () => {
    // Heavier fetchers don't fix DNS / refused connections.
    const r = decideNextTier({
      currentMode: "STATIC",
      consecutiveFailures: 5,
      outcomeKind: "NETWORK",
      autoEscalate: true,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("STATIC");
    expect(r.newConsecutiveFailures).toBe(6);
    expect(r.newFailureKind).toBe("NETWORK");
    expect(r.escalated).toBe(false);
  });

  it("does NOT escalate on TIMEOUT / PARSE / OTHER", () => {
    for (const k of ["TIMEOUT", "PARSE", "OTHER"] as const) {
      const r = decideNextTier({
        currentMode: "STATIC",
        consecutiveFailures: 2,
        outcomeKind: k,
        autoEscalate: true,
        escalateAfter: 3,
      });
      expect(r.escalated, `kind: ${k}`).toBe(false);
      expect(r.newMode, `kind: ${k}`).toBe("STATIC");
      expect(r.newFailureKind, `kind: ${k}`).toBe(k);
    }
  });

  it("increments the counter on BLOCKED but stays put below the threshold", () => {
    const r = decideNextTier({
      currentMode: "STATIC",
      consecutiveFailures: 1,
      outcomeKind: "BLOCKED",
      autoEscalate: true,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("STATIC");
    expect(r.newConsecutiveFailures).toBe(2);
    expect(r.escalated).toBe(false);
    expect(r.newFailureKind).toBe("BLOCKED");
  });

  it("escalates BLOCKED at the threshold and resets the counter", () => {
    const r = decideNextTier({
      currentMode: "STATIC",
      consecutiveFailures: 2,
      outcomeKind: "BLOCKED",
      autoEscalate: true,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("PLAYWRIGHT");
    expect(r.newConsecutiveFailures).toBe(0);
    expect(r.escalated).toBe(true);
  });

  it("walks the full ladder with repeated BLOCKED at threshold each tier", () => {
    // Phase 8: ladder is now STATIC → PLAYWRIGHT → STEALTH → CAMOUFOX → EXTERNAL
    let mode: "STATIC" | "PLAYWRIGHT" | "STEALTH" | "CAMOUFOX" | "EXTERNAL" = "STATIC";
    let count = 0;
    for (let i = 0; i < 16; i++) {
      const r = decideNextTier({
        currentMode: mode,
        consecutiveFailures: count,
        outcomeKind: "BLOCKED",
        autoEscalate: true,
        escalateAfter: 3,
      });
      mode = r.newMode;
      count = r.newConsecutiveFailures;
    }
    expect(mode).toBe("EXTERNAL");
  });

  it("does not escalate when autoEscalate is false", () => {
    const r = decideNextTier({
      currentMode: "STATIC",
      consecutiveFailures: 99,
      outcomeKind: "BLOCKED",
      autoEscalate: false,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("STATIC");
    expect(r.escalated).toBe(false);
    expect(r.newConsecutiveFailures).toBe(100);
  });

  it("does not escalate from EXTERNAL (top of the ladder)", () => {
    const r = decideNextTier({
      currentMode: "EXTERNAL",
      consecutiveFailures: 10,
      outcomeKind: "BLOCKED",
      autoEscalate: true,
      escalateAfter: 3,
    });
    expect(r.newMode).toBe("EXTERNAL");
    expect(r.escalated).toBe(false);
  });

  it("treats escalateAfter <= 0 as 'escalate on first BLOCKED'", () => {
    const r = decideNextTier({
      currentMode: "STATIC",
      consecutiveFailures: 0,
      outcomeKind: "BLOCKED",
      autoEscalate: true,
      escalateAfter: 0,
    });
    expect(r.escalated).toBe(true);
    expect(r.newMode).toBe("PLAYWRIGHT");
  });
});
