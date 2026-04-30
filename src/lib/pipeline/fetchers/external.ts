/**
 * External scraper API fetcher. Optional last-resort tier for sites that
 * Patchright still can't get through (rare; usually only the most
 * aggressively-defended portals).
 *
 * Configured via env:
 *   SCRAPER_API_URL  — POST endpoint URL. Token may be embedded as a query
 *                      param (Browserless) or sent in SCRAPER_API_KEY.
 *   SCRAPER_API_KEY  — bearer token sent in the Authorization header.
 *                      Optional when the URL already includes ?token=.
 *
 * Two API shapes are auto-detected from the endpoint URL:
 *
 *   1. Browserless (production-sfo.browserless.io / production-lon.browserless.io)
 *      → body  { url, formats: ["html"] }
 *      → resp  { ok, content, statusCode }   (smart-scrape format)
 *
 *   2. Generic { url } in / { html, status } out — works with custom proxies
 *      and most simple scraper APIs.
 *
 * If SCRAPER_API_URL is missing, the fetcher throws a clear error so the
 * dispatcher can report STEALTH-level "no further escalation possible"
 * instead of silently failing.
 */
import type { RawFetchResult } from "./static";
import { fetch as undiciFetch } from "undici";

const TIMEOUT_MS = 60_000;

interface BrowserlessSmartScrapeResp {
  // Production /smart-scrape shape (verified 2026-04).
  ok?: boolean;
  content?: string;
  statusCode?: number;
  message?: string | null;
  // Tolerated alternates in case the API surface changes.
  data?: Array<{ html?: string; status?: number; statusCode?: number }>;
  html?: string;
  status?: number;
}

interface GenericResp {
  html?: string;
  status?: number;
}

export async function fetchExternal(url: string): Promise<RawFetchResult> {
  const endpoint = process.env.SCRAPER_API_URL;
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!endpoint) {
    throw new Error(
      "SCRAPER_API_URL is not configured. Either set it (and SCRAPER_API_KEY) or " +
        "set the URL's autoEscalate to false to stop the pipeline trying EXTERNAL."
    );
  }

  const isBrowserless = /browserless\.io/i.test(endpoint);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = isBrowserless
      ? JSON.stringify({ url, formats: ["html"] })
      : JSON.stringify({ url });

    const res = await undiciFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Browserless embeds the token in the URL query, so we only set the
        // Authorization header when one was explicitly provided.
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      // Pull the error body text so the surface message is useful.
      const text = await res.text().catch(() => "");
      throw new Error(
        `scraper API returned HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`
      );
    }

    const json = (await res.json()) as BrowserlessSmartScrapeResp & GenericResp;

    if (isBrowserless) {
      // smart-scrape returns { ok, content, statusCode }. Older / alternate
      // shapes are tolerated as a defensive fallback.
      const first = Array.isArray(json.data) ? json.data[0] : undefined;
      const html = json.content ?? first?.html ?? json.html;
      const status = json.statusCode ?? first?.status ?? first?.statusCode ?? json.status ?? 200;
      if (typeof html !== "string") {
        throw new Error(
          `Browserless response missing content. Got: ${JSON.stringify(json).slice(0, 200)}`
        );
      }
      if (json.ok === false) {
        throw new Error(
          `Browserless reported ok=false: ${json.message ?? "(no message)"}`
        );
      }
      return { html, status };
    }

    if (typeof json.html !== "string") {
      throw new Error("scraper API response missing `html` field");
    }
    return { html: json.html, status: json.status ?? 200 };
  } finally {
    clearTimeout(timer);
  }
}
