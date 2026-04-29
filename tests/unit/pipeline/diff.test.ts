import { describe, it, expect } from "vitest";
import { computeDiff } from "@/lib/pipeline/diff";

describe("computeDiff", () => {
  it("reports identical text as no-op with no significance", () => {
    const result = computeDiff("hello world", "hello world");
    expect(result.addedChars).toBe(0);
    expect(result.removedChars).toBe(0);
    expect(result.addedLines).toEqual([]);
    expect(result.removedLines).toEqual([]);
    expect(result.isSignificant).toBe(false);
  });

  it("flags a small textual change as insignificant when both inputs are large enough", () => {
    // Pad with neutral context so the diff isn't 100% of either input.
    const padding = "x".repeat(2000);
    const before = `${padding}\nthe fee is $185\n${padding}`;
    const after = `${padding}\nthe fee is $190\n${padding}`;
    const result = computeDiff(before, after);
    expect(result.addedChars + result.removedChars).toBeLessThan(40);
    expect(result.isSignificant).toBe(false);
  });

  it("(KNOWN LIMITATION, Phase 2) flags a one-line edit on a tiny document as significant", () => {
    // diffLines splits on newlines; with no newlines the whole string is a single
    // added/removed unit, and pctChange exceeds 1%. Phase 2 (block-level diff)
    // replaces this heuristic; the behaviour is asserted here so any future
    // change to the threshold logic is intentional.
    const result = computeDiff("the fee is $185", "the fee is $190");
    expect(result.isSignificant).toBe(true);
  });

  it("flags a substantive paragraph addition as significant", () => {
    const before = "Mumbai consulate processes visas.\n";
    const after =
      before +
      "From May 1, 2026, the standard visa application fee is increased to $205, effective immediately.\n";
    const result = computeDiff(before, after);
    expect(result.isSignificant).toBe(true);
    expect(result.addedLines.some((l) => l.includes("$205"))).toBe(true);
    expect(result.addedLines.some((l) => l.includes("May 1, 2026"))).toBe(true);
  });

  it("flags a removal as significant when large enough", () => {
    const removed = "Appointment wait times are currently 90 days. Book through the official scheduling portal.";
    const before = `Header line.\n${removed}\nFooter line.`;
    const after = "Header line.\nFooter line.";
    const result = computeDiff(before, after);
    expect(result.isSignificant).toBe(true);
    expect(result.removedLines.some((l) => l.includes("Appointment wait"))).toBe(true);
  });

  it("captures both added and removed lines in unified output", () => {
    const before = "line a\nline b\nline c\n";
    const after = "line a\nline B (changed materially with extra text past forty chars)\nline c\n";
    const result = computeDiff(before, after);
    expect(result.unified).toContain("- line b");
    expect(result.unified).toMatch(/\+ line B/);
  });
});
