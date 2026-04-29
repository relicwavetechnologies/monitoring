/**
 * External scraper API fetcher. Optional last-resort tier for sites that
 * Patchright still can't get through (rare; usually only the most
 * aggressively-defended portals).
 *
 * Configured via env:
 *   SCRAPER_API_URL  — POST endpoint that takes { url } and returns { html, status }.
 *   SCRAPER_API_KEY  — bearer token sent in the Authorization header.
 *
 * If either is missing, the fetcher throws a clear error so the
 * dispatcher can report STEALTH-level "no further escalation possible"
 * instead of silently failing.
 */
import type { RawFetchResult } from "./static";
import { fetch as undiciFetch } from "undici";

const TIMEOUT_MS = 60_000;

export async function fetchExternal(url: string): Promise<RawFetchResult> {
  const endpoint = process.env.SCRAPER_API_URL;
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!endpoint) {
    throw new Error(
      "SCRAPER_API_URL is not configured. Either set it (and SCRAPER_API_KEY) or " +
        "set the URL's autoEscalate to false to stop the pipeline trying EXTERNAL."
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await undiciFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`scraper API returned HTTP ${res.status}`);
    }

    const body = (await res.json()) as { html?: string; status?: number };
    if (typeof body.html !== "string") {
      throw new Error("scraper API response missing `html` field");
    }
    return { html: body.html, status: body.status ?? 200 };
  } finally {
    clearTimeout(timer);
  }
}
