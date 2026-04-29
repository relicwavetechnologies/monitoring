import { fetch as undiciFetch, Agent } from "undici";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

// Default undici header cap is 16 KB — some gov sites return larger payloads
// and trigger UND_ERR_HEADERS_OVERFLOW. Lifted to 64 KB.
const dispatcher = new Agent({ maxHeaderSize: 65536 });

export interface RawFetchResult {
  html: string;
  status: number;
}

export async function fetchStatic(url: string): Promise<RawFetchResult> {
  const res = await undiciFetch(url, {
    headers: HEADERS,
    redirect: "follow",
    dispatcher,
  } as Parameters<typeof undiciFetch>[1]);
  const html = await res.text();
  return { html, status: res.status };
}
