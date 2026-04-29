import { describe, it, expect } from "vitest";
import { classifyResponse, classifyError } from "@/lib/pipeline/fetchers/block-detection";

describe("classifyResponse", () => {
  it("returns OK for a real-looking HTML page with status 200", () => {
    const html =
      "<html><body><main>" +
      "<h1>Real content</h1>" +
      "<p>".repeat(50) +
      "filler text body content here that takes up real space".repeat(20) +
      "</p>".repeat(50) +
      "</main></body></html>";
    expect(classifyResponse({ status: 200, html }).kind).toBe("OK");
  });

  it.each([403, 406, 429, 503])("flags status %d as BLOCKED", (status) => {
    const result = classifyResponse({ status, html: "<html>any</html>" });
    expect(result.kind).toBe("BLOCKED");
    expect(result.reason).toBe(`http-${status}`);
  });

  it("flags an empty body as PARSE", () => {
    expect(classifyResponse({ status: 200, html: "" }).kind).toBe("PARSE");
    expect(classifyResponse({ status: 200, html: "  \n  " }).kind).toBe("PARSE");
  });

  it("detects a Cloudflare 'Just a moment...' challenge page", () => {
    const html =
      "<html><head><title>Just a moment...</title></head><body>" +
      "<p>checking your browser before accessing</p></body></html>";
    const r = classifyResponse({ status: 200, html });
    expect(r.kind).toBe("BLOCKED");
    expect(r.reason).toBe("anti-bot-interstitial");
  });

  it("detects 'Verifying you are human' wording", () => {
    const html =
      "<html><body><p>Verifying you are human. This may take a few seconds.</p></body></html>";
    expect(classifyResponse({ status: 200, html }).kind).toBe("BLOCKED");
  });

  it("detects 'Cloudflare Ray ID' fingerprint in a short response", () => {
    const html =
      "<html><body><p>Sorry, you have been blocked. Cloudflare Ray ID: 12345</p></body></html>";
    const r = classifyResponse({ status: 200, html });
    expect(r.kind).toBe("BLOCKED");
    expect(r.reason).toBe("cloudflare-challenge");
  });

  it("detects a DataDome challenge", () => {
    const html =
      "<html><body><script src=\"https://captcha-delivery.com/c.js\"></script></body></html>";
    expect(classifyResponse({ status: 200, html }).kind).toBe("BLOCKED");
  });

  it("does NOT trip on a long article that happens to mention 'verifying'", () => {
    // Article-length response: not flagged even if a challenge phrase appears.
    const html =
      "<html><body>" +
      "<article>" +
      "We discuss our process for verifying you are human users in our forum guidelines. " +
      "Lorem ipsum dolor sit amet ".repeat(500) +
      "</article>" +
      "</body></html>";
    expect(classifyResponse({ status: 200, html }).kind).toBe("OK");
  });
});

describe("classifyError", () => {
  it("classifies AbortError as TIMEOUT", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifyError(err).kind).toBe("TIMEOUT");
  });

  it("classifies a 'timeout' message as TIMEOUT", () => {
    expect(classifyError(new Error("Request timeout after 30000ms")).kind).toBe("TIMEOUT");
  });

  it("classifies DNS / connection errors as NETWORK", () => {
    expect(classifyError(new Error("getaddrinfo ENOTFOUND example.com")).kind).toBe("NETWORK");
    expect(classifyError(new Error("connect ECONNREFUSED 127.0.0.1:443")).kind).toBe("NETWORK");
    expect(classifyError(new Error("socket hang up - ECONNRESET")).kind).toBe("NETWORK");
  });

  it("classifies a thrown 403/429/503 error message as BLOCKED", () => {
    expect(classifyError(new Error("HTTP 403 returned")).kind).toBe("BLOCKED");
    expect(classifyError(new Error("rate limited 429")).kind).toBe("BLOCKED");
  });

  it("buckets anything else into OTHER", () => {
    expect(classifyError(new Error("unexpected boom")).kind).toBe("OTHER");
    expect(classifyError("string thrown").kind).toBe("OTHER");
    expect(classifyError(undefined).kind).toBe("OTHER");
  });
});
