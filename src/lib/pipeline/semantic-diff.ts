/**
 * Phase 8: semantic-similarity fallback for ambiguous diffs.
 *
 * When the block-level diff says "65% of the page changed" but it's actually
 * just rewording, we don't want to fire a Change. We compute the cosine
 * similarity of the two texts' embeddings; if it's >= 0.92, we treat the
 * change as semantically null and short-circuit.
 *
 * The whole module is best-effort: if embeddings aren't available (no
 * OPENAI key, network error, model unsupported by the gateway), we return
 * null and the caller proceeds to classify normally.
 */
import { openai } from "@/lib/openai";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.semantic-diff");

const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
const MAX_INPUT_CHARS = 24_000; // ~6k tokens, fits in one call

/** Heuristic: when does it make sense to spend $0.0001 on an embedding check?
 *  - Diff is large enough to look "page rewrite" rather than "typo"
 *  - But not so tiny that we'd be wasting cycles
 */
export function isAmbiguousDiff(unifiedDiff: string, pageLength: number): boolean {
  if (pageLength < 500) return false;
  if (unifiedDiff.length < 200) return false;
  // If the diff is more than 30% of the page, suspect rewording.
  return unifiedDiff.length / pageLength > 0.3;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Embed two texts and return cosine similarity in [-1, 1]. NULL on failure. */
export async function semanticSimilarity(a: string, b: string): Promise<number | null> {
  const ta = a.slice(0, MAX_INPUT_CHARS);
  const tb = b.slice(0, MAX_INPUT_CHARS);
  if (ta.length === 0 || tb.length === 0) return null;
  try {
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: [ta, tb],
    });
    if (res.data.length < 2) return null;
    return cosine(res.data[0].embedding, res.data[1].embedding);
  } catch (err) {
    log.warn({ err, model: EMBED_MODEL }, "embedding call failed; falling through");
    return null;
  }
}
