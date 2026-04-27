import type { RenderMode } from "@/generated/prisma/enums";

export interface FetchResult {
  html: string;
  status: number;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export async function fetchSite(url: string, mode: RenderMode): Promise<FetchResult> {
  if (mode === "JS") {
    return fetchWithPlaywright(url);
  }
  return fetchStatic(url);
}

async function fetchStatic(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
    next: { revalidate: 0 },
  });
  const html = await res.text();
  return { html, status: res.status };
}

async function fetchWithPlaywright(url: string): Promise<FetchResult> {
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(HEADERS);
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    // Wait extra for dynamic content
    await page.waitForTimeout(2000);
    const html = await page.content();
    const status = response?.status() ?? 200;
    await browser.close();
    return { html, status };
  } catch {
    // Playwright not available in this environment — fall back to static
    return fetchStatic(url);
  }
}
