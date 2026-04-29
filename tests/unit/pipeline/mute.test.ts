import { describe, it, expect } from "vitest";
import { shouldMute } from "@/lib/pipeline/mute";

describe("shouldMute", () => {
  it("returns false when there are no patterns", () => {
    expect(shouldMute({ summary: "x", detail: null, category: "y", mutePatterns: [] }).muted).toBe(false);
  });

  it("matches a literal pattern in the summary", () => {
    const r = shouldMute({
      summary: "Weekly news roundup posted",
      detail: null,
      category: "POLICY_CHANGE",
      mutePatterns: ["weekly news roundup"],
    });
    expect(r.muted).toBe(true);
    expect(r.matchedPattern).toBe("weekly news roundup");
  });

  it("matches a regex pattern across summary + detail", () => {
    const r = shouldMute({
      summary: "Update",
      detail: "Site refreshed; counters reset.",
      category: "COSMETIC",
      mutePatterns: ["counters\\s+reset"],
    });
    expect(r.muted).toBe(true);
  });

  it("matches case-insensitively", () => {
    const r = shouldMute({
      summary: "WEEKLY ROUNDUP",
      detail: null,
      category: "POLICY_CHANGE",
      mutePatterns: ["weekly roundup"],
    });
    expect(r.muted).toBe(true);
  });

  it("returns false when no pattern matches", () => {
    const r = shouldMute({
      summary: "Fee changed to $200",
      detail: null,
      category: "FEE_CHANGE",
      mutePatterns: ["weekly", "roundup", "newsletter"],
    });
    expect(r.muted).toBe(false);
  });

  it("ignores invalid regex without throwing", () => {
    const r = shouldMute({
      summary: "anything",
      detail: null,
      category: "x",
      mutePatterns: ["[unclosed"],
    });
    expect(r.muted).toBe(false);
  });
});
