/**
 * Phase 8: when a meaningful change is detected on a URL, ask the LLM to
 * write a fresh "what's new" line and (optionally) update the topic-card's
 * summary so the dashboard card stays in sync with reality.
 *
 * Cheap call — uses MODELS.fast and runs only when a Change row is
 * actually created. Failures are non-fatal (we just leave the prior card).
 */
import { openai, MODELS, parseJsonSafe } from "@/lib/openai";
import { z } from "zod";
import type { StoredTopicCard } from "@/lib/adapters/topic-card";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.topic-card-refresh");

const RefreshSchema = z.object({
  /** One short sentence describing what changed, ≤180 chars. */
  changeNote: z.string().min(1).max(220),
  /** Optionally rewrite the summary to reflect the new state. NULL keeps existing. */
  summaryUpdate: z.string().min(1).max(400).nullable().default(null),
});

export interface TopicCardRefreshInput {
  card: StoredTopicCard;
  changeSummary: string;
  changeDetail?: string | null;
  diffText: string;
}

const SYSTEM_PROMPT = `You are updating a one-line "what's new" badge on a visa monitoring card.

You are given the topic card's current title and summary, plus a freshly-detected
change from the page (with summary, detail, and the actual added/removed text).

Output JSON:
  {
    "changeNote": <one short sentence, ≤180 chars, what changed in plain English>,
    "summaryUpdate": <rewritten summary if the page's *gist* changed; otherwise null>
  }

Rules:
  - changeNote MUST mention the specific changed value when one exists
    (e.g. "Tourist visa fee raised from $160 to $185").
  - Don't say "the page changed" — say *what* changed.
  - summaryUpdate is null unless the new content meaningfully changes what
    the page is about (e.g. fee table now lists 5 new visa types).`;

export async function refreshTopicCard(input: TopicCardRefreshInput): Promise<StoredTopicCard> {
  const userBlock = [
    `Card title: ${input.card.title}`,
    `Card summary: ${input.card.summary}`,
    `Important fields: ${input.card.importantFields.join(", ") || "(none)"}`,
    "",
    `Change summary: ${input.changeSummary}`,
    `Change detail: ${input.changeDetail ?? "(none)"}`,
    "",
    "Diff (truncated):",
    input.diffText.slice(0, 4000),
  ].join("\n");

  try {
    const res = await openai.chat.completions.create({
      model: MODELS.fast,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userBlock },
      ],
    });
    const parsed = RefreshSchema.parse(parseJsonSafe(res.choices[0].message.content));
    return {
      ...input.card,
      summary: parsed.summaryUpdate ?? input.card.summary,
      lastChangeNote: parsed.changeNote,
      lastChangeAt: new Date().toISOString(),
    };
  } catch (err) {
    log.warn({ err }, "topic card refresh failed; keeping prior card");
    // Best-effort fallback: at least surface that something changed.
    return {
      ...input.card,
      lastChangeNote: input.changeSummary.slice(0, 200),
      lastChangeAt: new Date().toISOString(),
    };
  }
}
