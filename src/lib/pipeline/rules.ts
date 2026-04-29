/**
 * Rule-based pre-classifier — runs before the LLM and produces hints that
 * the LLM is not allowed to ignore.
 *
 * The LLM is good at *summarising* a change but unreliable about *severity*
 * — the same diff can come back rated 2 on one call and 4 on another.
 * Rules close that loop:
 *
 *   - If a currency-amount changed, this is a fee change worth at least 4.
 *   - If "suspended / closed / not accepting" appears in the additions,
 *     appointments are affected, severity ≥ 4.
 *   - If "resumed / reopened / now accepting" appears in additions,
 *     appointments resumed, severity ≥ 4.
 *   - If "effective <date>" or "with effect from" appears near a number,
 *     something is changing on a known date, severity ≥ 3.
 *   - Pure whitespace / casing / punctuation diff → cosmetic, severity ≤ 1.
 *
 * The rule output is *advisory* — it produces (categoryHints, severityFloor,
 * severityCeiling). The LLM's chosen severity is then clamped into that
 * range; if the LLM's category is in `categoryHints`, we trust it,
 * otherwise we override to the strongest hint.
 *
 * Pure function. No I/O. No DOM globals.
 */

export type RuleCategory =
  | "POLICY_CHANGE"
  | "FEE_CHANGE"
  | "APPOINTMENT"
  | "DOCUMENT_REQUIREMENT"
  | "NAVIGATION"
  | "COSMETIC"
  | "UNKNOWN";

export interface RuleVerdict {
  /** Category hints in priority order — the first one is the strongest. */
  categoryHints: RuleCategory[];
  /** Lower bound on severity — the LLM cannot produce a final value below this. */
  severityFloor: number;
  /** Upper bound on severity — the LLM cannot produce a final value above this. */
  severityCeiling: number;
  /** Which rule patterns matched, useful for logging and debugging. */
  matched: string[];
}

export interface RuleInput {
  addedText: string;
  removedText: string;
  /** Set to true when the previous and new texts are identical after
   *  normalising whitespace, case, and punctuation — these diffs cannot
   *  carry meaning regardless of length. */
  whitespaceOnly?: boolean;
}

// ── Patterns ────────────────────────────────────────────────────────────────

/** $185, USD 185, 185 USD, ₹ 5,000, £25, €25.50, S$ 50, AED 500, etc. */
const CURRENCY_RE =
  /(?:\$|usd|gbp|eur|aed|sgd|inr|cad|aud|jpy|cny|euros?|pounds?|rupees?|dirhams?|dollars?|yen|yuan|₹|£|€|¥|s\$)\s*[0-9][0-9,]*(?:\.[0-9]+)?|[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:usd|gbp|eur|aed|sgd|inr|cad|aud|jpy|cny|euros?|pounds?|rupees?|dirhams?|dollars?|yen|yuan)/i;

/** Words that signal appointments closed / suspended / not available. */
const APPOINTMENT_CLOSED_RE =
  /\b(suspend(?:ed|ing)?|closed?|not accept(?:ing)?|temporarily unavailable|cannot book|no (?:appointments? )?available)\b/i;

/** Words that signal appointments are reopening / resuming / now available. */
const APPOINTMENT_OPENED_RE =
  /\b(resum(?:e|ed|ing)|reopen(?:ed|ing)?|now accept(?:ing)?|now available|booking is open|appointments? (?:are |is )?(?:now )?(?:open|available))\b/i;

/** "effective <date>", "with effect from", "starting <date>", "from <date>". */
const EFFECTIVE_DATE_RE =
  /\b(effective(?: (?:from|on))?|with effect from|starting(?: from)?|as of|from)\s+[A-Z0-9]/i;

/** Document / form requirement signals. */
const DOCUMENT_RE =
  /\b(required documents?|supporting documents?|must (?:provide|submit|include)|biometrics?|photographs?|passport size|fingerprint(?:ing|s)?|police clearance|background check)\b/i;

/** Policy / eligibility signals. */
const POLICY_RE =
  /\b(eligibility|eligible|ineligible|requirement|prerequisite|policy|rule|regulation|criteria|condition|category|visa type)\b/i;

// ── Helpers ─────────────────────────────────────────────────────────────────

function joinForScan(...parts: string[]): string {
  return parts.filter(Boolean).join("\n");
}

// ── Rule engine ─────────────────────────────────────────────────────────────

export function applyRules(input: RuleInput): RuleVerdict {
  const matched: string[] = [];
  const hints: RuleCategory[] = [];
  let floor = 1;
  let ceiling = 5;

  // Highest priority: pure cosmetic diffs short-circuit everything else.
  if (input.whitespaceOnly) {
    return {
      categoryHints: ["COSMETIC"],
      severityFloor: 1,
      severityCeiling: 1,
      matched: ["whitespace-only"],
    };
  }

  const added = input.addedText;
  const removed = input.removedText;
  const both = joinForScan(added, removed);

  // ── Currency / fee changes ────────────────────────────────────────────────
  // We require the currency pattern to appear on BOTH sides of the diff for
  // a "fee change" verdict. A currency only on one side often means a fee
  // line was added or removed — still a fee change but lower confidence.
  const currencyAdded = CURRENCY_RE.test(added);
  const currencyRemoved = CURRENCY_RE.test(removed);
  if (currencyAdded && currencyRemoved) {
    hints.push("FEE_CHANGE");
    matched.push("currency-both-sides");
    floor = Math.max(floor, 4);
  } else if (currencyAdded || currencyRemoved) {
    hints.push("FEE_CHANGE");
    matched.push("currency-one-side");
    floor = Math.max(floor, 3);
  }

  // ── Appointments ──────────────────────────────────────────────────────────
  if (APPOINTMENT_CLOSED_RE.test(added)) {
    hints.push("APPOINTMENT");
    matched.push("appointments-closed");
    floor = Math.max(floor, 4);
  }
  if (APPOINTMENT_OPENED_RE.test(added)) {
    hints.push("APPOINTMENT");
    matched.push("appointments-opened");
    floor = Math.max(floor, 4);
  }

  // ── Effective-date with a numeric → policy taking effect ──────────────────
  if (EFFECTIVE_DATE_RE.test(both)) {
    matched.push("effective-date");
    floor = Math.max(floor, 3);
  }

  // ── Document requirements ─────────────────────────────────────────────────
  if (DOCUMENT_RE.test(added) || DOCUMENT_RE.test(removed)) {
    hints.push("DOCUMENT_REQUIREMENT");
    matched.push("document-token");
    floor = Math.max(floor, 3);
  }

  // ── Policy / eligibility ──────────────────────────────────────────────────
  if (POLICY_RE.test(added) || POLICY_RE.test(removed)) {
    hints.push("POLICY_CHANGE");
    matched.push("policy-token");
    // Don't raise floor — "policy" appears in lots of cosmetic copy too.
  }

  // De-dup hints while preserving order.
  const seen = new Set<RuleCategory>();
  const dedupedHints = hints.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));

  return {
    categoryHints: dedupedHints,
    severityFloor: floor,
    severityCeiling: ceiling,
    matched,
  };
}

// ── Quote validation ────────────────────────────────────────────────────────

/**
 * Verify that every quote returned by the LLM is a substring of the diff
 * text it's claimed to come from. Loose matching: case-insensitive and
 * whitespace-collapsed so the LLM doesn't fail on a shifted space.
 */
export interface QuoteValidationResult {
  validated: string[];
  invalid: string[];
  allValid: boolean;
}

function normaliseForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateQuotes(quotes: string[], diffText: string): QuoteValidationResult {
  const haystack = normaliseForMatch(diffText);
  const validated: string[] = [];
  const invalid: string[] = [];
  for (const q of quotes) {
    const needle = normaliseForMatch(q);
    if (needle.length === 0) continue;
    if (haystack.includes(needle)) validated.push(q);
    else invalid.push(q);
  }
  return { validated, invalid, allValid: invalid.length === 0 };
}

// ── Severity clamping ───────────────────────────────────────────────────────

export interface ClampInput {
  llmSeverity: number;
  llmCategory: RuleCategory;
  rules: RuleVerdict;
}

export interface ClampResult {
  finalSeverity: number;
  finalCategory: RuleCategory;
  /** True if either the severity was moved or the category was overridden. */
  clamped: boolean;
}

/**
 * Clamp the LLM's severity into the rule-allowed band, and override the
 * category if the LLM's choice is incompatible with what the rules detected.
 */
export function clampToRules(input: ClampInput): ClampResult {
  const sev = Math.min(
    input.rules.severityCeiling,
    Math.max(input.rules.severityFloor, input.llmSeverity)
  );
  const severityClamped = sev !== input.llmSeverity;

  let category = input.llmCategory;
  let categoryOverridden = false;

  // If rules detected a strong hint and the LLM picked something unrelated,
  // override to the first hint. "UNKNOWN" from the LLM is always replaced
  // when we have any hint at all.
  if (input.rules.categoryHints.length > 0) {
    const hintsSet = new Set(input.rules.categoryHints);
    if (input.llmCategory === "UNKNOWN" || !hintsSet.has(input.llmCategory)) {
      // Only override on strong hints — don't second-guess the LLM if the
      // rule hint is just "POLICY_CHANGE" (which fires on any policy-ish
      // word) and the LLM picked something more specific.
      const strong = input.rules.categoryHints.find((c) =>
        c === "FEE_CHANGE" || c === "APPOINTMENT" || c === "COSMETIC"
      );
      if (strong) {
        category = strong;
        categoryOverridden = true;
      }
    }
  }

  return {
    finalSeverity: sev,
    finalCategory: category,
    clamped: severityClamped || categoryOverridden,
  };
}

// ── Whitespace-only detector ────────────────────────────────────────────────

export function isWhitespaceOnlyDiff(addedText: string, removedText: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}]/gu, "");
  return norm(addedText) === norm(removedText);
}
