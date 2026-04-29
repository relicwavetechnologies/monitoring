/**
 * Reorder-resilient set diff over blocks.
 *
 * Given the blocks of two snapshots, emits three buckets:
 *   - added:   present in the new set, absent in the old one
 *   - removed: present in the old set, absent in the new one
 *   - edited:  a removed/added pair where the texts are similar enough to
 *              be considered an edit, not an unrelated swap
 *
 * Reordering identical content yields zero added / removed / edited.
 * Editing a paragraph yields exactly one entry in `edited`.
 * Adding a brand-new paragraph yields one in `added`. And so on.
 *
 * Significance is computed against the *changed* characters only, weighted
 * by length, so a single typo on a 5,000-character page stays quiet.
 *
 * No I/O, no globals. Pure function.
 */

export interface BlockShape {
  blockHash: string;
  text: string;
  kind: string;
  idx: number;
}

export interface BlockEditPair {
  before: BlockShape;
  after: BlockShape;
  similarity: number;
}

export interface BlockDiffResult {
  added: BlockShape[];
  removed: BlockShape[];
  edited: BlockEditPair[];
  /** Total characters changed across added + removed + edited (counting both sides of an edit). */
  changedChars: number;
  isSignificant: boolean;
  /** Unified diff string for human display. Compact, not exhaustive. */
  unified: string;
}

export interface BlockDiffOptions {
  minDiffChars?: number;
  /** Minimum similarity (0..1) at which an add/remove pair becomes an edit. Default 0.6. */
  editThreshold?: number;
}

const DEFAULT_MIN_DIFF_CHARS = 40;
// 0.5 matches "fee changed and a clause was added" cases (similarity ~0.55-0.6)
// while still rejecting unrelated paragraphs (similarity ~0.1-0.3).
// Tightenable per call via options.editThreshold.
const DEFAULT_EDIT_THRESHOLD = 0.5;

/** Damerau-Levenshtein distance, capped at maxDistance to keep cost bounded. */
function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  // Standard two-row DP.
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * 0..1 similarity. 1 = identical, 0 = completely unrelated.
 * Bounded — for very different lengths we don't compute the full matrix.
 */
function similarityScore(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  // Cheap pre-check: very different lengths are very different blocks.
  const lenRatio = Math.min(a.length, b.length) / longest;
  if (lenRatio < 0.3) return 0;
  // Cap the distance computation at half the longer string — anything beyond
  // that won't reach the edit threshold anyway.
  const cap = Math.ceil(longest / 2);
  const dist = boundedLevenshtein(a, b, cap);
  if (dist > cap) return 0;
  return 1 - dist / longest;
}

export function computeBlockDiff(
  prevBlocks: BlockShape[],
  currBlocks: BlockShape[],
  options: BlockDiffOptions = {}
): BlockDiffResult {
  const minDiffChars = options.minDiffChars ?? DEFAULT_MIN_DIFF_CHARS;
  const editThreshold = options.editThreshold ?? DEFAULT_EDIT_THRESHOLD;

  // Map by hash for O(1) lookup. If the same block hash appears multiple times
  // (rare; e.g. two empty cells), each instance counts separately.
  function bucket(arr: BlockShape[]): Map<string, BlockShape[]> {
    const m = new Map<string, BlockShape[]>();
    for (const b of arr) {
      const list = m.get(b.blockHash);
      if (list) list.push(b);
      else m.set(b.blockHash, [b]);
    }
    return m;
  }

  const prevByHash = bucket(prevBlocks);
  const currByHash = bucket(currBlocks);

  const removed: BlockShape[] = [];
  const added: BlockShape[] = [];

  // Walk previous blocks: anything not matched in current is "removed".
  for (const [hash, prevList] of prevByHash) {
    const currList = currByHash.get(hash) ?? [];
    const matched = Math.min(prevList.length, currList.length);
    for (let i = matched; i < prevList.length; i++) removed.push(prevList[i]);
    if (matched > 0) {
      // Drop matched copies from currByHash so we don't double-count.
      currByHash.set(hash, currList.slice(matched));
    }
  }
  // Anything left in currByHash is "added".
  for (const list of currByHash.values()) added.push(...list);

  // Pair removed-vs-added blocks of the *same kind* with high similarity to
  // detect "edits" — typo fixes, fee number changes, single-word swaps.
  const edited: BlockEditPair[] = [];
  const usedAdded = new Set<number>();
  const survivors: BlockShape[] = [];

  for (const before of removed) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < added.length; i++) {
      if (usedAdded.has(i)) continue;
      if (added[i].kind !== before.kind) continue;
      const score = similarityScore(before.text, added[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= editThreshold) {
      edited.push({ before, after: added[bestIdx], similarity: bestScore });
      usedAdded.add(bestIdx);
    } else {
      survivors.push(before);
    }
  }
  const remainingAdded = added.filter((_, i) => !usedAdded.has(i));

  // Significance: pure-add chars + pure-remove chars + (edit a-len + b-len)/2
  // (an edit is ~half the cost of a full add and a full remove).
  const addedChars = remainingAdded.reduce((n, b) => n + b.text.length, 0);
  const removedChars = survivors.reduce((n, b) => n + b.text.length, 0);
  const editedChars = edited.reduce(
    (n, p) => n + (p.before.text.length + p.after.text.length) / 2,
    0
  );
  const changedChars = addedChars + removedChars + editedChars;

  const isSignificant = changedChars >= minDiffChars;

  // Unified-style output for human display. Truncated.
  const lines: string[] = [];
  for (const e of edited.slice(0, 20)) {
    lines.push(`~ [${e.before.kind}] ${truncate(e.before.text, 200)}`);
    lines.push(`  → ${truncate(e.after.text, 200)}`);
  }
  for (const a of remainingAdded.slice(0, 20)) {
    lines.push(`+ [${a.kind}] ${truncate(a.text, 200)}`);
  }
  for (const r of survivors.slice(0, 20)) {
    lines.push(`- [${r.kind}] ${truncate(r.text, 200)}`);
  }

  return {
    added: remainingAdded,
    removed: survivors,
    edited,
    changedChars,
    isSignificant,
    unified: lines.join("\n"),
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
