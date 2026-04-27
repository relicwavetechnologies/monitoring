import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { ChangeCategory } from "@/generated/prisma/enums";

const ClassificationSchema = z.object({
  category: z.enum([
    "POLICY_CHANGE",
    "FEE_CHANGE",
    "APPOINTMENT",
    "DOCUMENT_REQUIREMENT",
    "NAVIGATION",
    "COSMETIC",
    "UNKNOWN",
  ]),
  severity: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(160),
  detail: z.string().max(700),
});

export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM_PROMPT = `You are a visa application assistant that monitors government and embassy websites for changes that matter to visa applicants.

Analyze the diff provided and classify the change:

CATEGORIES:
- POLICY_CHANGE: Changes to visa rules, eligibility, requirements, restrictions
- FEE_CHANGE: Changes to visa fees, payment methods, service charges
- APPOINTMENT: Changes to appointment availability, booking systems, wait times
- DOCUMENT_REQUIREMENT: Changes to required documents, forms, supporting materials
- NAVIGATION: Menu restructuring, link changes, page reorganisation (no content change)
- COSMETIC: Minor wording, formatting, whitespace, punctuation (no meaning change)
- UNKNOWN: Cannot determine

SEVERITY (from a visa applicant's perspective):
1 - Cosmetic/irrelevant
2 - Minor informational update
3 - Notable change worth knowing about
4 - Important change that affects applications
5 - Critical change that could invalidate or block applications

CONFIDENCE: How certain are you this classification is correct (0.0-1.0).

Return JSON with fields: category, severity, confidence, summary (max 140 chars, actionable), detail (max 600 chars).`;

export async function classifyChange(
  siteName: string,
  siteUrl: string,
  addedLines: string[],
  removedLines: string[]
): Promise<Classification> {
  const diffContext = [
    "=== ADDED (new content) ===",
    addedLines.slice(0, 50).join("\n"),
    "",
    "=== REMOVED (old content) ===",
    removedLines.slice(0, 50).join("\n"),
  ].join("\n");

  const tryModel = async (model: typeof MODELS[keyof typeof MODELS]): Promise<Classification> => {
    const res = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Site: ${siteName}\nURL: ${siteUrl}\n\n${diffContext}`,
        },
      ],
    });

    const raw = JSON.parse(res.choices[0].message.content ?? "{}");
    return ClassificationSchema.parse(raw);
  };

  const result = await tryModel(MODELS.fast);

  // Escalate to best model if confidence is low
  if (result.confidence < 0.6) {
    return tryModel(MODELS.best);
  }

  return result;
}

export function categoryToEnum(cat: string): ChangeCategory {
  const map: Record<string, ChangeCategory> = {
    POLICY_CHANGE: ChangeCategory.POLICY_CHANGE,
    FEE_CHANGE: ChangeCategory.FEE_CHANGE,
    APPOINTMENT: ChangeCategory.APPOINTMENT,
    DOCUMENT_REQUIREMENT: ChangeCategory.DOCUMENT_REQUIREMENT,
    NAVIGATION: ChangeCategory.NAVIGATION,
    COSMETIC: ChangeCategory.COSMETIC,
    UNKNOWN: ChangeCategory.UNKNOWN,
  };
  return map[cat] ?? ChangeCategory.UNKNOWN;
}
