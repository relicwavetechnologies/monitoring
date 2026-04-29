import { describe, it, expect } from "vitest";
import { isMonitoredUrlDue } from "@/lib/pipeline/tick-logic";

describe("isMonitoredUrlDue", () => {
  it("is due when never checked before", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-29T10:00:00Z"),
        lastCheckedAt: null,
        pollIntervalMin: 60,
      })
    ).toBe(true);
  });

  it("is not due when the interval hasn't elapsed", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-29T10:30:00Z"),
        lastCheckedAt: new Date("2026-04-29T10:00:00Z"),
        pollIntervalMin: 60,
      })
    ).toBe(false);
  });

  it("is due exactly on the interval edge", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-29T11:00:00Z"),
        lastCheckedAt: new Date("2026-04-29T10:00:00Z"),
        pollIntervalMin: 60,
      })
    ).toBe(true);
  });

  it("is due once the interval has clearly elapsed", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-30T10:00:00Z"),
        lastCheckedAt: new Date("2026-04-29T10:00:00Z"),
        pollIntervalMin: 60,
      })
    ).toBe(true);
  });

  it("treats a zero-interval URL as always due", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-29T10:00:01Z"),
        lastCheckedAt: new Date("2026-04-29T10:00:00Z"),
        pollIntervalMin: 0,
      })
    ).toBe(true);
  });

  it("treats a negative interval as zero (never trip on bad input)", () => {
    expect(
      isMonitoredUrlDue({
        now: new Date("2026-04-29T10:00:00Z"),
        lastCheckedAt: new Date("2026-04-29T10:00:00Z"),
        pollIntervalMin: -100,
      })
    ).toBe(true);
  });
});
