import { fetch as undiciFetch, Agent } from "undici";

const dispatcher = new Agent({ maxHeaderSize: 65536, connectTimeout: 8000 });
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

async function main() {
  const url = "https://visa.vfsglobal.com/are/en/sgp/apply-visa";
  console.log(`Fetching: ${url}\n`);
  try {
    const res = await undiciFetch(url, {
      headers: HEADERS,
      redirect: "follow",
      dispatcher,
    } as Parameters<typeof undiciFetch>[1]);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Final URL:", res.url);
    const body = await res.text();
    console.log("Body length:", body.length);
    console.log("Body preview:", body.slice(0, 500));
  } catch (err) {
    console.log("ERROR:", err);
  }
}
main();
