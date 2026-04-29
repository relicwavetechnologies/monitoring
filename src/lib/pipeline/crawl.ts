/**
 * Site spider — BFS crawl of same-origin links.
 *
 * Starts at rootUrl, discovers linked pages on the same domain,
 * fetches and extracts each one, returns a flat list ordered by
 * discovery depth (breadth-first). Designed for the AI analysis
 * pass — NOT used by the change-detection pipeline.
 */
import * as cheerio from "cheerio";
import { fetch as undiciFetch, Agent } from "undici";
import { extractContent } from "./extract";

const dispatcher = new Agent({ maxHeaderSize: 65536, connectTimeout: 8000 });

// File extensions to skip — nothing useful for text analysis
const SKIP_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".gz", ".tar", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".mp4", ".mp3", ".avi", ".mov",
  ".css", ".js", ".woff", ".woff2", ".ttf",
]);

// URL patterns that are noise / session-specific
const SKIP_PATTERN = /[?&](session|token|sid|jsessionid|phpsessid|utm_|ref=)/i;

export interface CrawledPage {
  url: string;
  path: string;
  title: string;
  text: string;
  /** Raw HTML kept in-memory for the duration of the poll; not persisted.
   *  Phase 2a uses this to do block-level extraction across all crawled pages. */
  html: string;
  depth: number;
  status: number;
}

export interface CrawlResult {
  pages: CrawledPage[];
  totalDiscovered: number; // including skipped/errored pages
  rootOrigin: string;
}

interface CrawlOptions {
  /** CSS selector to focus content on (falls back to body if no match) */
  contentSelector?: string;
  /** Regex patterns to strip from extracted text */
  stripPatterns?: string[];
  /** How many link-hops deep to follow (default 2) */
  maxDepth?: number;
  /** Hard cap on pages fetched (default 20) */
  maxPages?: number;
  /** Per-page fetch timeout in ms (default 10 000) */
  pageTimeoutMs?: number;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function fetchPage(
  url: string,
  timeoutMs: number
): Promise<{ html: string; status: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await undiciFetch(url, {
      headers: HEADERS,
      redirect: "follow",
      dispatcher,
      signal: controller.signal,
    } as Parameters<typeof undiciFetch>[1]);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null; // skip non-HTML responses
    }

    const html = await res.text();
    return { html, status: res.status };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract <title> text from HTML */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
}

/** Pull all same-origin hrefs from a page */
function extractLinks(html: string, baseUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;

    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      return;
    }

    // Same origin only
    if (resolved.origin !== origin) return;

    // Skip anchor-only (same-page) links
    if (resolved.pathname === new URL(baseUrl).pathname && resolved.hash) return;

    // Skip noisy extensions
    const ext = resolved.pathname.slice(resolved.pathname.lastIndexOf(".")).toLowerCase();
    if (SKIP_EXT.has(ext)) return;

    // Skip session/token-looking query strings
    if (SKIP_PATTERN.test(resolved.search)) return;

    // Normalise: strip fragment, trailing slash for comparison
    resolved.hash = "";
    links.push(resolved.href);
  });

  return links;
}

export async function crawlSite(rootUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const {
    contentSelector = "body",
    stripPatterns = [],
    maxDepth = 2,
    maxPages = 20,
    pageTimeoutMs = 10_000,
  } = opts;

  const rootOrigin = new URL(rootUrl).origin;

  // BFS state
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
  const visited = new Set<string>([normalise(rootUrl)]);
  const pages: CrawledPage[] = [];
  let totalDiscovered = 1;

  while (queue.length > 0 && pages.length < maxPages) {
    const { url, depth } = queue.shift()!;

    const fetched = await fetchPage(url, pageTimeoutMs);
    if (!fetched) continue;

    const { html, status } = fetched;
    const title = extractTitle(html);
    const text = extractContent(html, contentSelector, stripPatterns);
    const path = new URL(url).pathname;

    pages.push({ url, path, title, text, html, depth, status });

    // Don't follow links from pages at max depth
    if (depth >= maxDepth) continue;

    const links = extractLinks(html, url, rootOrigin);
    for (const link of links) {
      const key = normalise(link);
      if (!visited.has(key)) {
        visited.add(key);
        totalDiscovered++;
        queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  return { pages, totalDiscovered, rootOrigin };
}

/** Normalise URL for dedup: lowercase, no trailing slash, no fragment */
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
