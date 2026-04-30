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
 * Playwright with a warning.
 *
 * Phase 8: now also supports residential proxy injection (PROXY_URL env)
 * and lightweight behavioral noise (mouse + scroll) to defeat the basic
 * "no pointer events" Cloudflare heuristic.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PatchrightModule = { chromium: any } | null;

interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

function readProxyConfig(): ProxyConfig | null {
  const url = process.env.PROXY_URL;
  if (!url) return null;
  try {
    const u = new URL(url);
    const username = u.username || process.env.PROXY_USERNAME || undefined;
    const password = u.password || process.env.PROXY_PASSWORD || undefined;
    u.username = "";
    u.password = "";
    return { server: u.toString(), username, password };
  } catch {
    return null;
  }
}

async function injectBehavioralNoise(page: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = page as any;
  try {
    const x = 200 + Math.floor(Math.random() * 600);
    const y = 200 + Math.floor(Math.random() * 400);
    await p.mouse.move(x, y, { steps: 8 });
    await p.waitForTimeout(400 + Math.floor(Math.random() * 600));
    await p.evaluate(() => window.scrollTo({ top: window.innerHeight / 2, behavior: "smooth" }));
    await p.waitForTimeout(800 + Math.floor(Math.random() * 600));
  } catch {
    // best-effort
  }
}

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

  const proxy = readProxyConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const launchOpts: any = { headless: true };
  if (proxy) launchOpts.proxy = proxy;

  const browser = await patchright.chromium.launch(launchOpts);
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: HEADERS,
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Cloudflare's challenge can take a few seconds to clear once it
    // decides to let us through. Patchright handles the JS challenge.
    await injectBehavioralNoise(page);
    await page.waitForTimeout(2_500 + Math.floor(Math.random() * 1_500));
    const html = await page.content();
    const status = response?.status() ?? 200;
    let screenshot: Buffer | undefined;
    try {
      screenshot = (await page.screenshot({ fullPage: false, type: "png" })) as Buffer;
    } catch {
      screenshot = undefined;
    }
    return { html, status, screenshot };
  } finally {
    await browser.close();
  }
}
