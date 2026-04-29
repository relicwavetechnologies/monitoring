/**
 * Pure block-level extraction from HTML.
 *
 * Walks the DOM in document order and emits one Block per block-level
 * element (heading, paragraph, list item, table cell, …). Each block
 * carries its hash, kind, and normalised text.
 *
 * The block hash is `sha256(kind + ':' + normalised(text))` so two blocks
 * with the same wording but different kinds (e.g. an <h2> vs a <p>) never
 * collide. Normalisation collapses whitespace and strips a small set of
 * always-noisy characters; it does NOT lowercase, because case is often
 * meaningful in policy text ("USD" vs "usd").
 *
 * The function is pure: no I/O, no DOM globals. Cheerio handles the parse.
 */
import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

export type ExtractStrategy = "SELECTOR" | "READABILITY" | "BODY";

export interface Block {
  idx: number;
  blockHash: string;
  text: string;
  kind: string;
}

export interface ExtractBlocksResult {
  blocks: Block[];
  /** Which strategy actually produced the blocks. */
  strategy: ExtractStrategy;
  /** Concatenated `text` of all blocks, joined by "\n\n". Lets callers reuse the
   *  legacy text-based code paths during the migration window without re-walking
   *  the DOM. */
  flatText: string;
  /** SHA-256 of the sorted block hashes, joined by "\n". Identical content in
   *  any order produces the same value. */
  blocksHash: string;
}

/** Element kinds we promote to blocks, in CSS-selector form. */
const BLOCK_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, li, td, th, pre, blockquote, dt, dd, summary, figcaption";

/** Element kinds we explicitly remove before walking — they're never content. */
const REMOVE_SELECTOR =
  "script, style, noscript, template, [aria-hidden='true'], .cookie-banner, #cookie-notice";

function normalise(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function hashBlock(kind: string, text: string): string {
  return createHash("sha256").update(`${kind}:${text}`, "utf8").digest("hex");
}

function applyStripPatterns(text: string, patterns: string[]): string {
  let out = text;
  for (const p of patterns) {
    try {
      out = out.replace(new RegExp(p, "gi"), "");
    } catch {
      // ignore invalid regex
    }
  }
  return out;
}

/**
 * Compute blocksHash from a list of blocks. Sorts by hash so order doesn't
 * affect the result. Pure; safe to call from anywhere.
 */
export function computeBlocksHash(blocks: Block[]): string {
  if (blocks.length === 0) return createHash("sha256").update("empty", "utf8").digest("hex");
  const sorted = blocks.map((b) => b.blockHash).sort();
  return createHash("sha256").update(sorted.join("\n"), "utf8").digest("hex");
}

export interface ExtractOptions {
  selector: string;
  stripPatterns: string[];
  /** Reserved for Phase 2b — when true, falls back to Readability if the
   *  selector match is too small. Phase 2a hard-codes `false` from callers. */
  enableReadabilityFallback?: boolean;
}

export function extractBlocks(html: string, options: ExtractOptions): ExtractBlocksResult {
  const $ = cheerio.load(html);
  $(REMOVE_SELECTOR).remove();

  const selector = options.selector || "body";
  let region = $(selector);
  let strategy: ExtractStrategy = "SELECTOR";
  if (region.length === 0 || region.text().trim().length === 0) {
    region = $("body");
    strategy = "BODY";
  }

  const blocks: Block[] = [];
  region.find(BLOCK_SELECTOR).each((_, el) => {
    const $el = $(el);
    // Skip blocks that contain other block elements — we'd double-count text.
    if ($el.find(BLOCK_SELECTOR).length > 0) return;
    const kind = el.tagName.toLowerCase();
    const raw = applyStripPatterns($el.text(), options.stripPatterns);
    const text = normalise(raw);
    if (text.length === 0) return;
    blocks.push({ idx: blocks.length, blockHash: hashBlock(kind, text), text, kind });
  });

  // If the region produced no blocks at all, fall back to body's full text
  // as a single synthetic <p> block. Better than zero.
  if (blocks.length === 0) {
    const bodyText = normalise(applyStripPatterns($("body").text(), options.stripPatterns));
    if (bodyText.length > 0) {
      blocks.push({
        idx: 0,
        blockHash: hashBlock("p", bodyText),
        text: bodyText,
        kind: "p",
      });
      strategy = "BODY";
    }
  }

  const flatText = blocks.map((b) => b.text).join("\n\n");
  const blocksHash = computeBlocksHash(blocks);

  return { blocks, strategy, flatText, blocksHash };
}
