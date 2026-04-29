import { z } from "zod";
import { openai, MODELS, modelCostUsd } from "@/lib/openai";
import { ChangeCategory } from "@/generated/prisma/enums";
import {
  applyRules,
  clampToRules,
  validateQuotes,
  isWhitespaceOnlyDiff,
  type RuleCategory,
  type RuleVerdict,
} from "@/lib/pipeline/rules";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.classify");

/** Bumped any time the system prompt or output schema changes. The current
 *  Change row records this so we can A/B old vs new prompts on the
 *  calibration suite. */
export const PROMPT_VERSION = "v2";

const CategoryEnum = z.enum([
  "POLICY_CHANGE",
  "FEE_CHANGE",
  "APPOINTMENT",
  "DOCUMENT_REQUIREMENT",
  "NAVIGATION",
  "COSMETIC",
  "UNKNOWN",
]);

const ClassificationSchema = z.object({
  category: CategoryEnum,
  severity: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(160),
  detail: z.string().max(700).nullable(),
  /** Phase 3: every classification must cite at least one verbatim quote
   *  from the diff. Empty array is rejected by the validator below. */
  evidence_quotes: z.array(z.string().min(1).max(500)).max(8),
});

export type Classification = z.infer<typeof ClassificationSchema>;

/** Status flag exposed to run-poll, mirroring the DB enum. */
export type ClassifyStatus = "VALIDATED" | "CLAMPED" | "UNGROUNDED" | "FALLBACK";

export interface ClassifyResult {
  category: ChangeCategory;
  severity: number;
  confidence: number;
  summary: string;
  detail: string | null;
  /** Verified verbatim quotes from the diff text. */
  evidenceQuotes: string[];
  status: ClassifyStatus;
  /** Severity the LLM originally returned, before any clamp. */
  rawSeverity: number;
  /** Which model produced the final answer. */
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const SYSTEM_PROMPT = `You are a visa application assistant that monitors government and embassy websites for changes that matter to visa applicants.

You will receive the ADDED and REMOVED text of a single diff and (optionally) a set of rule hints flagged by a deterministic pre-classifier. Your job:

1. Classify the change into ONE category.
2. Rate severity 1-5 from a visa applicant's perspective.
3. Rate your own confidence 0.0-1.0 in the classification.
4. Write a one-line summary (≤140 chars, actionable).
5. Optionally write a detail paragraph (≤600 chars).
6. Cite 1-3 verbatim quotes from the ADDED or REMOVED text that justify your verdict.

CATEGORIES:
- POLICY_CHANGE: Changes to visa rules, eligibility, requirements, restrictions
- FEE_CHANGE: Changes to visa fees, payment methods, service charges
- APPOINTMENT: Changes to appointment availability, booking systems, wait times
- DOCUMENT_REQUIREMENT: Changes to required documents, forms, supporting materials
- NAVIGATION: Menu restructuring, link changes, page reorganisation (no content change)
- COSMETIC: Minor wording, formatting, whitespace, punctuation (no meaning change)
- UNKNOWN: Cannot determine

SEVERITY (visa-applicant perspective):
1 - Cosmetic / irrelevant
2 - Minor informational update
3 - Notable change worth knowing about
4 - Important change that affects applications
5 - Critical change that could invalidate or block applications

GROUNDING REQUIREMENTS (strict):
- evidence_quotes MUST be exact substrings of the ADDED or REMOVED text.
- Do NOT paraphrase. Copy the words exactly. Whitespace differences are tolerated.
- If you cannot cite at least one quote, set category=UNKNOWN, severity=1, confidence=0.

Return JSON: { category, severity, confidence, summary, detail, evidence_quotes }`;

interface ApiCallResult {
  classification: Classification;
  tokensIn: number;
  tokensOut: number;
  model: string;
  costUsd: number;
}

async function callModel(
  model: string,
  siteName: string,
  siteUrl: string,
  addedText: string,
  removedText: string,
  ruleHints: string[]
): Promise<ApiCallResult> {
  const ruleHintBlock =
    ruleHints.length > 0
      ? `\nRULE HINTS (deterministic pre-classifier):\n${ruleHints.map((h) => `- ${h}`).join("\n")}\n`
      : "";

  const userBlock = [
    `Site: ${siteName}`,
    `URL: ${siteUrl}`,
    ruleHintBlock,
    "=== ADDED (new content) ===",
    addedText,
    "",
    "=== REMOVED (old content) ===",
    removedText,
  ].join("\n");

  const res = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userBlock },
    ],
  });

  const raw = JSON.parse(res.choices[0].message.content ?? "{}");
  const classification = ClassificationSchema.parse(raw);

  const tokensIn = res.usage?.prompt_tokens ?? 0;
  const tokensOut = res.usage?.completion_tokens ?? 0;
  const costUsd = modelCostUsd(model, tokensIn, tokensOut);

  return { classification, tokensIn, tokensOut, model, costUsd };
}

function categoryToDb(cat: RuleCategory | string): ChangeCategory {
  switch (cat) {
    case "POLICY_CHANGE":
      return ChangeCategory.POLICY_CHANGE;
    case "FEE_CHANGE":
      return ChangeCategory.FEE_CHANGE;
    case "APPOINTMENT":
      return ChangeCategory.APPOINTMENT;
    case "DOCUMENT_REQUIREMENT":
      return ChangeCategory.DOCUMENT_REQUIREMENT;
    case "NAVIGATION":
      return ChangeCategory.NAVIGATION;
    case "COSMETIC":
      return ChangeCategory.COSMETIC;
    default:
      return ChangeCategory.UNKNOWN;
  }
}

/** Decide whether the result of a model call needs an escalation pass. */
function needsEscalation(result: ApiCallResult, rules: RuleVerdict): boolean {
  if (result.classification.confidence < 0.6) return true;
  if (result.classification.severity >= 4) return true;
  if (rules.severityFloor >= 4) return true;
  return false;
}

export interface ClassifyInput {
  siteName: string;
  siteUrl: string;
  addedLines: string[];
  removedLines: string[];
  /** Full diff text used to validate evidence quotes. Should be the same
   *  string the user sees in the dashboard / email. */
  diffText: string;
}

export async function classifyChange(input: ClassifyInput): Promise<ClassifyResult> {
  const addedText = input.addedLines.slice(0, 80).join("\n");
  const removedText = input.removedLines.slice(0, 80).join("\n");

  // ── 1. Run deterministic rules first ──────────────────────────────────────
  const rules = applyRules({
    addedText,
    removedText,
    whitespaceOnly: isWhitespaceOnlyDiff(addedText, removedText),
  });

  // ── 2. Call the fast model ────────────────────────────────────────────────
  let api: ApiCallResult;
  try {
    api = await callModel(MODELS.fast, input.siteName, input.siteUrl, addedText, removedText, rules.matched);
  } catch (err) {
    log.error({ err, model: MODELS.fast }, "fast classifier call failed; falling back");
    return fallback(rules);
  }

  // ── 3. Escalate if confidence is low or the change looks important ────────
  if (needsEscalation(api, rules)) {
    try {
      const better = await callModel(MODELS.best, input.siteName, input.siteUrl, addedText, removedText, rules.matched);
      // Prefer the escalation result if its confidence is at least as high.
      if (better.classification.confidence >= api.classification.confidence) {
        api = {
          ...better,
          tokensIn: api.tokensIn + better.tokensIn,
          tokensOut: api.tokensOut + better.tokensOut,
          costUsd: api.costUsd + better.costUsd,
        };
      }
    } catch (err) {
      log.warn({ err, model: MODELS.best }, "escalation call failed; keeping fast result");
    }
  }

  // ── 4. Validate evidence quotes against the actual diff text ──────────────
  const validation = validateQuotes(api.classification.evidence_quotes, input.diffText);
  let status: ClassifyStatus = "VALIDATED";
  if (!validation.allValid && validation.validated.length === 0) {
    // No verifiable quotes at all → ungrounded.
    status = "UNGROUNDED";
    log.warn(
      {
        invalid: validation.invalid.slice(0, 3),
        site: input.siteName,
      },
      "classifier returned only ungroundable quotes"
    );
  } else if (!validation.allValid) {
    log.info(
      { invalid: validation.invalid.slice(0, 3) },
      "some classifier quotes were ungroundable; keeping the verified ones"
    );
  }

  // ── 5. Apply rule clamps ──────────────────────────────────────────────────
  const clamp = clampToRules({
    llmSeverity: api.classification.severity,
    llmCategory: api.classification.category,
    rules,
  });
  if (clamp.clamped && status === "VALIDATED") status = "CLAMPED";

  return {
    category: categoryToDb(clamp.finalCategory),
    severity: clamp.finalSeverity,
    confidence: api.classification.confidence,
    summary: api.classification.summary,
    detail: api.classification.detail,
    evidenceQuotes: validation.validated,
    status,
    rawSeverity: api.classification.severity,
    model: api.model,
    promptVersion: PROMPT_VERSION,
    tokensIn: api.tokensIn,
    tokensOut: api.tokensOut,
    costUsd: api.costUsd,
  };
}

function fallback(rules: RuleVerdict): ClassifyResult {
  // The LLM call crashed. Use the rules' best guess so the row still gets a
  // sensible severity floor; the caller will mark this as FALLBACK.
  const cat = rules.categoryHints[0] ?? "UNKNOWN";
  return {
    category: categoryToDb(cat),
    severity: rules.severityFloor,
    confidence: 0,
    summary: "Change detected but classifier was unavailable; showing rule-based guess.",
    detail: null,
    evidenceQuotes: [],
    status: "FALLBACK",
    rawSeverity: rules.severityFloor,
    model: "fallback",
    promptVersion: PROMPT_VERSION,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };
}

/** Backwards-compat shim. Some callers (e.g. older paths) still expect the
 *  Phase 1 `categoryToEnum` helper that took a string. Kept in place so the
 *  Phase 3 PR is purely additive at the call-site level. */
export function categoryToEnum(cat: string): ChangeCategory {
  return categoryToDb(cat);
}
