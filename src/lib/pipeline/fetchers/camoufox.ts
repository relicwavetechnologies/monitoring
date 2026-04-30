/**
 * Phase 8: Camoufox fetcher — patched Firefox build with engine-level
 * stealth and randomised fingerprints. Used when STEALTH (Patchright/Chromium)
 * gets blocked: a different browser surface area defeats fingerprinting that
 * keys on Chromium-specific signals.
 *
 * Camoufox is OPTIONAL: it ships its own Firefox binary. On the runtime VM:
 *
 *     pip install -U camoufox[geoip]
 *     camoufox fetch         # downloads the patched Firefox
 *
 * The Node bridge is the `camoufox-js` package (or any `playwright`-API-
 * compatible wrapper). If it's not installed at runtime, this fetcher
 * falls back to Patchright (`fetchStealth`) so the URL still gets a JS
 * fetch.
 *
 * Optional residential-proxy support reads:
 *   PROXY_URL       — full proxy URL, e.g. "http://user:pass@gw.example.com:7777"
 *   PROXY_USERNAME / PROXY_PASSWORD — split credentials (alt to embedding in URL)
 */
import type { RawFetchResult } from "./static";
import { fetchStealth } from "./stealth";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.fetchers.camoufox");

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CamoufoxModule = { firefox: any } | null;

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
    // Strip credentials from the server URL — Playwright wants them separate.
    u.username = "";
    u.password = "";
    return { server: u.toString(), username, password };
  } catch {
    log.warn({ url }, "PROXY_URL is not a valid URL — ignoring");
    return null;
  }
}

/** Inject lightweight behavioral noise: random scroll + small mouse moves.
 *  Cloudflare's behavioral classifier flags pages that scrape-and-leave with
 *  zero pointer or scroll events. */
async function injectBehavioralNoise(page: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = page as any;
  try {
    // Move mouse to a random spot, then scroll halfway, then a bit more.
    const x = 200 + Math.floor(Math.random() * 600);
    const y = 200 + Math.floor(Math.random() * 400);
    await p.mouse.move(x, y, { steps: 8 });
    await p.waitForTimeout(400 + Math.floor(Math.random() * 600));
    await p.evaluate(() => window.scrollTo({ top: window.innerHeight / 2, behavior: "smooth" }));
    await p.waitForTimeout(800 + Math.floor(Math.random() * 600));
    await p.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" }));
    await p.waitForTimeout(400 + Math.floor(Math.random() * 600));
  } catch {
    // best-effort
  }
}

export async function fetchCamoufox(url: string): Promise<RawFetchResult> {
  let camoufox: CamoufoxModule = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    camoufox = (await import(/* webpackIgnore: true */ "camoufox-js" as any).catch(
      () => null
    )) as CamoufoxModule;
  } catch {
    camoufox = null;
  }

  if (!camoufox?.firefox) {
    log.warn(
      { url },
      "camoufox-js not installed — falling back to STEALTH (Patchright). " +
        "On the prod VM: pip install -U camoufox[geoip] && camoufox fetch && pnpm add camoufox-js"
    );
    return fetchStealth(url);
  }

  const proxy = readProxyConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const launchOpts: any = {
    headless: true,
    // Camoufox-specific: rotate the WebGL/canvas fingerprint per launch.
    fingerprint: { os: ["windows", "macos"], screen: { minWidth: 1280, minHeight: 720 } },
  };
  if (proxy) launchOpts.proxy = proxy;

  const browser = await camoufox.firefox.launch(launchOpts);
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: HEADERS,
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await injectBehavioralNoise(page);
    // Final wait for any JS-deferred content.
    await page.waitForTimeout(2_000 + Math.floor(Math.random() * 2_000));
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
