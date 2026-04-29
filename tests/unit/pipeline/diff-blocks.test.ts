import { describe, it, expect } from "vitest";
import { computeBlockDiff, type BlockShape } from "@/lib/pipeline/diff-blocks";
import { extractBlocks } from "@/lib/pipeline/extract-blocks";
import { loadFixture } from "../../helpers/fixtures";

function block(kind: string, text: string, idx = 0): BlockShape {
  // Use a deterministic hash based on (kind, text) so identical pairs match.
  // We'd use the real hash function but that creates an import cycle; the
  // diff engine treats the hash as opaque so any deterministic hash works.
  const blockHash = `${kind}:${text.length}:${Buffer.from(text).toString("base64")}`;
  return { idx, blockHash, kind, text };
}

describe("computeBlockDiff", () => {
  it("treats two identical block lists as no-change", () => {
    const a = [block("p", "hello"), block("p", "world", 1)];
    const b = [block("p", "hello"), block("p", "world", 1)];
    const r = computeBlockDiff(a, b);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(0);
    expect(r.edited).toHaveLength(0);
    expect(r.isSignificant).toBe(false);
  });

  it("reordering is a no-op (the killer feature)", () => {
    const a = [
      block("p", "alpha block content here that is fairly long", 0),
      block("p", "beta block content also fairly long for realism", 1),
      block("p", "gamma block third one in the original order", 2),
    ];
    const b = [a[2], a[0], a[1]];
    const r = computeBlockDiff(a, b);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(0);
    expect(r.edited).toHaveLength(0);
    expect(r.isSignificant).toBe(false);
  });

  it("a brand-new block is reported as added", () => {
    const a = [block("p", "the fee is one hundred and eighty-five dollars")];
    const b = [
      block("p", "the fee is one hundred and eighty-five dollars"),
      block("p", "appointments will reopen on June 1, 2026, please book then"),
    ];
    const r = computeBlockDiff(a, b);
    expect(r.added).toHaveLength(1);
    expect(r.added[0].text).toContain("appointments will reopen");
    expect(r.removed).toHaveLength(0);
    expect(r.edited).toHaveLength(0);
    expect(r.isSignificant).toBe(true);
  });

  it("a removed block is reported as removed", () => {
    const a = [
      block("p", "the fee is one hundred and eighty-five dollars"),
      block("p", "appointments will reopen on June 1, 2026, please book then"),
    ];
    const b = [block("p", "the fee is one hundred and eighty-five dollars")];
    const r = computeBlockDiff(a, b);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(1);
    expect(r.edited).toHaveLength(0);
    expect(r.isSignificant).toBe(true);
  });

  it("an edited block is paired into `edited`, not double-counted as add+remove", () => {
    const before = "Standard visa application fee is one hundred and eighty-five dollars effective immediately.";
    const after = "Standard visa application fee is two hundred and five dollars effective immediately.";
    const a = [block("p", before)];
    const b = [block("p", after)];
    const r = computeBlockDiff(a, b);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(0);
    expect(r.edited).toHaveLength(1);
    expect(r.edited[0].before.text).toBe(before);
    expect(r.edited[0].after.text).toBe(after);
    expect(r.edited[0].similarity).toBeGreaterThan(0.6);
    expect(r.isSignificant).toBe(true);
  });

  it("does NOT pair unrelated blocks: a removed paragraph and an unrelated added paragraph stay separate", () => {
    const a = [
      block(
        "p",
        "appointment slots are released on the first Monday of each month at 9 AM local time"
      ),
    ];
    const b = [
      block(
        "p",
        "the fee schedule has been updated to reflect new tariffs imposed by the home ministry"
      ),
    ];
    const r = computeBlockDiff(a, b);
    expect(r.edited).toHaveLength(0);
    expect(r.added).toHaveLength(1);
    expect(r.removed).toHaveLength(1);
  });

  it("does not pair across kinds: an h2 and a p with similar text are not an edit", () => {
    const text = "Important notice about appointments and fees today";
    const a = [block("h2", text)];
    const b = [block("p", text)];
    const r = computeBlockDiff(a, b);
    expect(r.edited).toHaveLength(0);
    expect(r.added).toHaveLength(1);
    expect(r.removed).toHaveLength(1);
  });

  it("falls below significance for tiny edits when minDiffChars is high", () => {
    const a = [block("p", "the fee is $185 effective immediately for all applications now")];
    const b = [block("p", "the fee is $190 effective immediately for all applications now")];
    const r = computeBlockDiff(a, b, { minDiffChars: 100 });
    expect(r.edited).toHaveLength(1);
    expect(r.isSignificant).toBe(false);
  });

  it("survives mixed add / remove / edit / unchanged in a single diff", () => {
    const a = [
      block("p", "unchanged paragraph that stays the same across the diff", 0),
      block("p", "fee is $185 across the board for the standard track today", 1),
      block("p", "old paragraph being removed entirely from the document", 2),
    ];
    const b = [
      block("p", "fee is $205 across the board for the standard track today", 0),
      block("p", "unchanged paragraph that stays the same across the diff", 1),
      block(
        "p",
        "brand new paragraph announcing reopened appointments effective June 1",
        2
      ),
    ];
    const r = computeBlockDiff(a, b);
    expect(r.edited).toHaveLength(1);
    expect(r.edited[0].before.text).toContain("$185");
    expect(r.edited[0].after.text).toContain("$205");
    expect(r.added).toHaveLength(1);
    expect(r.added[0].text).toContain("brand new");
    expect(r.removed).toHaveLength(1);
    expect(r.removed[0].text).toContain("old paragraph");
  });

  describe("on real-shape fixtures", () => {
    it("baseline → cosmetic-only fixture: zero significant change", () => {
      const a = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        { selector: "main", stripPatterns: [] }
      ).blocks;
      const b = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-30-cosmetic").html,
        { selector: "main", stripPatterns: [] }
      ).blocks;
      const r = computeBlockDiff(a, b);
      expect(r.changedChars).toBe(0);
      expect(r.isSignificant).toBe(false);
    });

    it("baseline → fee-change fixture: exactly one edit, paired correctly", () => {
      const a = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        { selector: "main", stripPatterns: [] }
      ).blocks;
      const b = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-30-fee-change").html,
        { selector: "main", stripPatterns: [] }
      ).blocks;
      const r = computeBlockDiff(a, b);
      expect(r.edited).toHaveLength(1);
      expect(r.edited[0].before.text).toContain("$185");
      expect(r.edited[0].after.text).toContain("$205");
      expect(r.added).toHaveLength(0);
      expect(r.removed).toHaveLength(0);
      expect(r.isSignificant).toBe(true);
    });
  });
});
