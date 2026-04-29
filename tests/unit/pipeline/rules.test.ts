import { describe, it, expect } from "vitest";
import {
  applyRules,
  clampToRules,
  validateQuotes,
  isWhitespaceOnlyDiff,
} from "@/lib/pipeline/rules";

describe("applyRules", () => {
  it("flags FEE_CHANGE with floor 4 when currency appears on both sides", () => {
    const r = applyRules({
      addedText: "Standard visa application fee: $205, effective May 1, 2026.",
      removedText: "Standard visa application fee: $185.",
    });
    expect(r.categoryHints).toContain("FEE_CHANGE");
    expect(r.severityFloor).toBeGreaterThanOrEqual(4);
    expect(r.matched).toContain("currency-both-sides");
  });

  it("flags FEE_CHANGE with floor 3 when currency appears on only one side", () => {
    const r = applyRules({
      addedText: "Application fee is now $200.",
      removedText: "There is a fee for processing.",
    });
    expect(r.categoryHints).toContain("FEE_CHANGE");
    expect(r.severityFloor).toBe(3);
    expect(r.matched).toContain("currency-one-side");
  });

  it("recognises multiple currency symbols and abbreviations", () => {
    const cases = [
      "the fee is now £25",
      "now ₹5,000",
      "USD 185",
      "AED 500",
      "S$ 50",
      "now 250 dollars",
    ];
    for (const text of cases) {
      const r = applyRules({ addedText: text, removedText: "" });
      expect(r.categoryHints, `case: ${text}`).toContain("FEE_CHANGE");
    }
  });

  it("flags APPOINTMENT with floor 4 when an addition mentions suspended/closed", () => {
    const r = applyRules({
      addedText: "Appointment bookings are temporarily suspended due to high demand.",
      removedText: "Book your appointment online.",
    });
    expect(r.categoryHints).toContain("APPOINTMENT");
    expect(r.severityFloor).toBeGreaterThanOrEqual(4);
    expect(r.matched).toContain("appointments-closed");
  });

  it("flags APPOINTMENT with floor 4 when an addition mentions resumed/reopened", () => {
    const r = applyRules({
      addedText: "Appointments are now available for new applicants starting June 1.",
      removedText: "Bookings are not available at this time.",
    });
    expect(r.categoryHints).toContain("APPOINTMENT");
    expect(r.severityFloor).toBeGreaterThanOrEqual(4);
    expect(r.matched).toContain("appointments-opened");
  });

  it("raises floor to 3 on 'effective <date>' wording", () => {
    const r = applyRules({
      addedText: "The new policy is effective from May 1, 2026.",
      removedText: "",
    });
    expect(r.severityFloor).toBeGreaterThanOrEqual(3);
    expect(r.matched).toContain("effective-date");
  });

  it("flags DOCUMENT_REQUIREMENT and POLICY_CHANGE on relevant tokens", () => {
    const r = applyRules({
      addedText: "Required documents now include a police clearance certificate.",
      removedText: "",
    });
    expect(r.categoryHints).toContain("DOCUMENT_REQUIREMENT");
    expect(r.matched).toContain("document-token");
  });

  it("returns COSMETIC + ceiling 1 for whitespace-only diffs", () => {
    const r = applyRules({
      addedText: "Apply now",
      removedText: "Apply Now",
      whitespaceOnly: true,
    });
    expect(r.categoryHints).toEqual(["COSMETIC"]);
    expect(r.severityCeiling).toBe(1);
    expect(r.severityFloor).toBe(1);
  });

  it("returns floor 1 / ceiling 5 / no hints for an unremarkable diff", () => {
    const r = applyRules({
      addedText: "We have updated our welcome message.",
      removedText: "Welcome to the embassy.",
    });
    expect(r.severityFloor).toBe(1);
    expect(r.severityCeiling).toBe(5);
    expect(r.categoryHints).toEqual([]);
  });
});

describe("validateQuotes", () => {
  const diff = "=== ADDED ===\nStandard visa application fee: $205, effective May 1, 2026.\n=== REMOVED ===\nStandard visa application fee: $185.";

  it("validates quotes that appear verbatim in the diff", () => {
    const v = validateQuotes(["fee: $205", "Standard visa application fee: $185"], diff);
    expect(v.allValid).toBe(true);
    expect(v.validated).toHaveLength(2);
  });

  it("validates quotes with extra whitespace", () => {
    const v = validateQuotes(["fee:    $205"], diff);
    expect(v.allValid).toBe(true);
  });

  it("rejects quotes that aren't in the diff", () => {
    const v = validateQuotes(
      ["this clause was hallucinated by the model and is not in the source"],
      diff
    );
    expect(v.allValid).toBe(false);
    expect(v.invalid).toHaveLength(1);
  });

  it("partitions a mix of valid and invalid quotes", () => {
    const v = validateQuotes(["fee: $205", "definitely not in the diff anywhere"], diff);
    expect(v.validated).toHaveLength(1);
    expect(v.invalid).toHaveLength(1);
    expect(v.allValid).toBe(false);
  });

  it("matches case-insensitively", () => {
    const v = validateQuotes(["STANDARD VISA APPLICATION FEE"], diff);
    expect(v.allValid).toBe(true);
  });

  it("ignores empty quote strings", () => {
    const v = validateQuotes(["", "  ", "fee: $205"], diff);
    expect(v.validated).toHaveLength(1);
    expect(v.invalid).toHaveLength(0);
  });
});

describe("clampToRules", () => {
  it("clamps a low severity up to the rule floor", () => {
    const r = clampToRules({
      llmSeverity: 2,
      llmCategory: "FEE_CHANGE",
      rules: { categoryHints: ["FEE_CHANGE"], severityFloor: 4, severityCeiling: 5, matched: [] },
    });
    expect(r.finalSeverity).toBe(4);
    expect(r.clamped).toBe(true);
  });

  it("clamps a high severity down to the rule ceiling", () => {
    const r = clampToRules({
      llmSeverity: 5,
      llmCategory: "COSMETIC",
      rules: { categoryHints: ["COSMETIC"], severityFloor: 1, severityCeiling: 1, matched: [] },
    });
    expect(r.finalSeverity).toBe(1);
    expect(r.clamped).toBe(true);
  });

  it("leaves severity untouched when it's within the rule band", () => {
    const r = clampToRules({
      llmSeverity: 4,
      llmCategory: "FEE_CHANGE",
      rules: { categoryHints: ["FEE_CHANGE"], severityFloor: 4, severityCeiling: 5, matched: [] },
    });
    expect(r.finalSeverity).toBe(4);
    expect(r.clamped).toBe(false);
  });

  it("overrides UNKNOWN to a strong rule hint when one exists", () => {
    const r = clampToRules({
      llmSeverity: 2,
      llmCategory: "UNKNOWN",
      rules: { categoryHints: ["FEE_CHANGE"], severityFloor: 4, severityCeiling: 5, matched: [] },
    });
    expect(r.finalCategory).toBe("FEE_CHANGE");
    expect(r.clamped).toBe(true);
  });

  it("does NOT override the LLM when the rule hint is weak (POLICY_CHANGE)", () => {
    const r = clampToRules({
      llmSeverity: 3,
      llmCategory: "DOCUMENT_REQUIREMENT",
      rules: { categoryHints: ["POLICY_CHANGE"], severityFloor: 1, severityCeiling: 5, matched: [] },
    });
    expect(r.finalCategory).toBe("DOCUMENT_REQUIREMENT");
  });

  it("never clamps when the rules carry no hints and the band is full-range", () => {
    const r = clampToRules({
      llmSeverity: 3,
      llmCategory: "POLICY_CHANGE",
      rules: { categoryHints: [], severityFloor: 1, severityCeiling: 5, matched: [] },
    });
    expect(r.clamped).toBe(false);
    expect(r.finalSeverity).toBe(3);
    expect(r.finalCategory).toBe("POLICY_CHANGE");
  });
});

describe("isWhitespaceOnlyDiff", () => {
  it("returns true when only casing differs", () => {
    expect(isWhitespaceOnlyDiff("Apply now", "Apply Now")).toBe(true);
  });

  it("returns true when only whitespace differs", () => {
    expect(isWhitespaceOnlyDiff("hello   world", "hello world")).toBe(true);
  });

  it("returns true when only punctuation differs", () => {
    expect(isWhitespaceOnlyDiff("Welcome.", "Welcome!")).toBe(true);
  });

  it("returns false when content differs meaningfully", () => {
    expect(isWhitespaceOnlyDiff("the fee is $185", "the fee is $205")).toBe(false);
  });
});
