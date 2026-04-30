/**
 * Phase 8 bootstrap crawler: visit a root URL, BFS-discover up to N
 * same-origin pages, extract the body text from each, and ask the LLM
 * to write one topic card per page.
 *
 * The result is what the wizard shows to the user as a grid of cards
 * for review/dismiss before saving the site. Each surviving card becomes
 * one MonitoredUrl row at save-time.
 *
 * Notes:
 *   - Uses the dispatchFetch tier system (so a STEALTH-required site uses
 *     Patchright transparently). Per-host concurrency is enforced.
 *   - LLM card generation runs in parallel with fetches (capped concurrency).
 *   - Pages classified SKIP are dropped from the result.
 */
import * as cheerio from "cheerio";
import { dispatchFetch } from "@/lib/pipeline/fetchers";
import { extractContent } from "@/lib/pipeline/extract";
import {
  generateTopicCard,
  type TopicCard,
} from "@/lib/adapters/topic-card";
import { getLogger } from "@/lib/logger";
import type { FetchMode } from "@/generated/prisma/enums";

const log = getLogger("adapters.bootstrap-crawl");

const SKIP_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".gz", ".tar", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".mp4", ".mp3", ".avi", ".mov",
  ".css", ".js", ".woff", ".woff2", ".ttf",
]);

const SKIP_PATTERN = /[?&](session|token|sid|jsessionid|phpsessid|utm_|ref=)/i;

/** URL paths likely to be noise — skipped during BFS. */
const SKIP_PATH_PATTERN = /\/(privacy|terms|cookies?|sitemap|search|login|signin|signup|register|cart|account|profile|careers?|jobs|press(-?releases)?|legal|accessibility|disclaimer|copyright|404|error)(\b|\/|$)/i;

export interface BootstrapPage {
  url: string;
  path: string;
  title: string;
  text: string;
  depth: number;
  /** LLM-generated topic card. May be null when generation fails. */
  card: TopicCard | null;
  /** True when the LLM said this page is not visa-relevant. */
  skipped: boolean;
}

export interface BootstrapCrawlResult {
  rootOrigin: string;
  fetchModeUsed: FetchMode;
  pages: BootstrapPage[];
  totalDiscovered: number;
  /** Per-page errors (URL → reason). Reported in UI for transparency. */
  errors: Array<{ url: string; reason: string }>;
}

export interface BootstrapCrawlOptions {
  /** BFS depth cap. Default 2. */
  maxDepth?: number;
  /** Hard cap on pages fetched. Default 25. */
  maxPages?: number;
  /** Initial fetch tier. Defaults to STATIC; the dispatcher escalates as needed. */
  initialMode?: FetchMode;
  /** Concurrency for LLM card generation. Default 3. */
  cardConcurrency?: number;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
}

function extractLinks(html: string, baseUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;
    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      return;
    }
    if (resolved.origin !== origin) return;
    const ext = resolved.pathname.slice(resolved.pathname.lastIndexOf(".")).toLowerCase();
    if (SKIP_EXT.has(ext)) return;
    if (SKIP_PATTERN.test(resolved.search)) return;
    if (SKIP_PATH_PATTERN.test(resolved.pathname)) return;
    resolved.hash = "";
    out.push(resolved.href);
  });
  return out;
}

function normalise(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let p = u.pathname.replace(/\/+$/, "") || "/";
    return (u.origin + p + u.search).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Bounded parallel-map. Keeps order. */
async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(
      (async () => {
        while (next < items.length) {
          const i = next++;
          results[i] = await fn(items[i], i);
        }
      })()
    );
  }
  await Promise.all(workers);
  return results;
}

export async function bootstrapCrawl(
  rootUrl: string,
  opts: BootstrapCrawlOptions = {}
): Promise<BootstrapCrawlResult> {
  const maxDepth = opts.maxDepth ?? 2;
  const maxPages = opts.maxPages ?? 25;
  const initialMode = opts.initialMode ?? "STATIC";
  const cardConcurrency = opts.cardConcurrency ?? 2;

  const rootOrigin = new URL(rootUrl).origin;
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
  const visited = new Set<string>([normalise(rootUrl)]);
  const fetched: Array<{ url: string; depth: number; html: string; status: number }> = [];
  const errors: Array<{ url: string; reason: string }> = [];
  let totalDiscovered = 1;
  let fetchModeUsed: FetchMode = initialMode;

  while (queue.length > 0 && fetched.length < maxPages) {
    const { url, depth } = queue.shift()!;
    let dispatch;
    try {
      dispatch = await dispatchFetch({ url, mode: fetchModeUsed });
    } catch (err) {
      errors.push({ url, reason: `dispatch threw: ${String(err)}` });
      continue;
    }
    if (dispatch.outcome.kind !== "OK") {
      // Try escalating once if we're getting blocked at the root.
      if (
        url === rootUrl &&
        dispatch.outcome.kind === "BLOCKED" &&
        fetchModeUsed === "STATIC"
      ) {
        log.info({ url }, "bootstrap escalating STATIC → STEALTH due to BLOCKED root");
        fetchModeUsed = "STEALTH";
        try {
          dispatch = await dispatchFetch({ url, mode: fetchModeUsed });
        } catch (err) {
          errors.push({ url, reason: `STEALTH dispatch threw: ${String(err)}` });
          continue;
        }
      }
      if (dispatch.outcome.kind !== "OK") {
        errors.push({
          url,
          reason: `${dispatch.outcome.kind}${dispatch.outcome.reason ? `:${dispatch.outcome.reason}` : ""}`,
        });
        continue;
      }
    }

    fetched.push({ url, depth, html: dispatch.html, status: dispatch.status });

    if (depth < maxDepth) {
      const links = extractLinks(dispatch.html, url, rootOrigin);
      for (const link of links) {
        const key = normalise(link);
        if (!visited.has(key)) {
          visited.add(key);
          totalDiscovered++;
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  // ── Card generation: parallel, bounded ─────────────────────────────────────
  const pages: BootstrapPage[] = await pMap(fetched, cardConcurrency, async (p) => {
    const title = extractTitle(p.html);
    const text = extractContent(p.html, "main", []) || extractContent(p.html, "body", []);
    let card: TopicCard | null = null;
    let skipped = false;
    if (text.trim().length < 200) {
      // Too thin to bother classifying. Mark as skipped.
      skipped = true;
    } else {
      try {
        card = await generateTopicCard(p.url, title, text);
        if (card.category === "SKIP") skipped = true;
      } catch (err) {
        log.warn({ err, url: p.url }, "topic card generation failed; keeping page without card");
      }
    }
    return {
      url: p.url,
      path: new URL(p.url).pathname,
      title,
      text: text.slice(0, 4000),
      depth: p.depth,
      card,
      skipped,
    };
  });

  return { rootOrigin, fetchModeUsed, pages, totalDiscovered, errors };
}
