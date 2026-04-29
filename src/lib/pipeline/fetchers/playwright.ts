/**
 * Vanilla Playwright fetcher. Used when a site needs JS rendering but
 * doesn't have aggressive anti-bot. Stock Chromium fingerprint; will be
 * blocked by 2026 Cloudflare on protected sites — that's what STEALTH is
 * for.
 *
 * Uses dynamic import so the rest of the app boots even if `playwright-core`
 * binaries aren't installed in the runtime image.
 */
import type { RawFetchResult } from "./static";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function fetchPlaywright(url: string): Promise<RawFetchResult> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ extraHTTPHeaders: HEADERS });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Some pages render content shortly after networkidle.
    await page.waitForTimeout(1_500);
    const html = await page.content();
    const status = response?.status() ?? 200;
    return { html, status };
  } finally {
    await browser.close();
  }
}
