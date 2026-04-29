/**
 * Stealth fetcher — Patchright (Chromium binary patches that defeat
 * fingerprint-level Cloudflare detection in 2026). Drop-in replacement
 * for the Playwright API.
 *
 * Patchright is OPTIONAL: it ships its own browser binaries that need to
 * be installed separately on the runtime image:
 *
 *     npx patchright install chromium
 *
 * If patchright isn't installed, this fetcher falls back to vanilla
 * Playwright with a warning (so the site at least gets a JS fetch even
 * if it'll likely be blocked).
 */
import type { RawFetchResult } from "./static";
import { fetchPlaywright } from "./playwright";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.fetchers.stealth");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// patchright is an optional dependency: not in package.json by default so
// CI / dev environments build cleanly without it. The runtime VM installs
// it (and its Chromium binaries) explicitly. This `any` cast is intentional
// — we treat the dynamic import as untyped at the boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PatchrightModule = { chromium: any } | null;

export async function fetchStealth(url: string): Promise<RawFetchResult> {
  let patchright: PatchrightModule = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patchright = (await import(/* webpackIgnore: true */ "patchright" as any).catch(
      () => null
    )) as PatchrightModule;
  } catch {
    patchright = null;
  }

  if (!patchright?.chromium) {
    log.warn(
      { url },
      "patchright not installed — falling back to vanilla Playwright. " +
        "On the prod VM run: npx patchright install chromium"
    );
    return fetchPlaywright(url);
  }

  const browser = await patchright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ extraHTTPHeaders: HEADERS });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Cloudflare's challenge can take a few seconds to clear once it
    // decides to let us through. The patchright binary handles the JS
    // challenge; we just need to wait for the resulting redirect.
    await page.waitForTimeout(3_000);
    const html = await page.content();
    const status = response?.status() ?? 200;
    return { html, status };
  } finally {
    await browser.close();
  }
}
