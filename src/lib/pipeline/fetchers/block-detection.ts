/**
 * Pure block-detection: classify a fetch outcome as a real response, a
 * known anti-bot block, a transient network failure, etc.
 *
 * Catching "blocked" cleanly is what makes auto-escalation work — the
 * previous code only knew "fetch threw" vs "got HTML", which conflates
 * a Cloudflare challenge page (HTML 200, but not the content we wanted)
 * with a real successful poll. After this module:
 *
 *   classifyResponse({ status: 200, html: '<html>Just a moment...</html>' })
 *     → { kind: "BLOCKED", reason: "cloudflare-challenge" }
 *
 * No I/O, no globals.
 */

export type FetchOutcomeKind =
  | "OK"
  | "BLOCKED"
  | "NETWORK"
  | "TIMEOUT"
  | "PARSE"
  | "OTHER";

export interface FetchOutcome {
  kind: FetchOutcomeKind;
  /** Short human-readable reason — used for logging and the dashboard. */
  reason?: string;
}

const BLOCK_STATUSES = new Set<number>([403, 406, 429, 503]);

/** Patterns that strongly indicate a Cloudflare challenge or similar anti-bot
 *  interstitial. We err on the side of false-positive only when the response
 *  is *also* tiny — a real page that mentions "verifying you are human" in a
 *  blog post shouldn't trip this. */
const CHALLENGE_PATTERNS: RegExp[] = [
  /just a moment/i,
  /please wait while we verify/i,
  /verifying you are human/i,
  /checking your browser/i,
  /enable javascript and cookies to continue/i,
  /attention required[\s\S]{0,40}cloudflare/i,
  /cloudflare ray id/i,
  /\bcf-mitigated\b/i,
  /<title>access denied<\/title>/i,
  /datadome/i,
  /captcha-delivery\.com/i,
  /perimeterx/i,
];

/** Threshold under which we'll treat a "challenge"-looking response as
 *  definitively blocked even if the content is HTML 200. Real content pages
 *  typically have several KB of text. */
const CHALLENGE_HTML_MAX_LENGTH = 8_000;

export function classifyResponse(input: {
  status: number;
  html: string;
}): FetchOutcome {
  // 1. Status-code-based blocks are unambiguous.
  if (BLOCK_STATUSES.has(input.status)) {
    return { kind: "BLOCKED", reason: `http-${input.status}` };
  }

  // 2. Challenge-page detection runs BEFORE the tiny-body short-circuit.
  // A 200 response under the size cap that matches a known challenge
  // pattern is a block — even (especially) when the body is short.
  if (input.html && input.html.length <= CHALLENGE_HTML_MAX_LENGTH) {
    for (const re of CHALLENGE_PATTERNS) {
      if (re.test(input.html)) {
        return { kind: "BLOCKED", reason: matchReason(re) };
      }
    }
  }

  // 3. Empty or near-empty body that didn't match any block pattern →
  // we got nothing useful but it's not clearly a block. Treat as PARSE
  // so the escalation logic doesn't promote.
  if (!input.html || input.html.trim().length < 200) {
    return { kind: "PARSE", reason: "empty-or-tiny-body" };
  }

  // 4. Otherwise it's a real response.
  return { kind: "OK" };
}

function matchReason(re: RegExp): string {
  const src = re.source.toLowerCase();
  if (src.includes("cloudflare") || src.includes("cf-mitigated")) return "cloudflare-challenge";
  if (src.includes("datadome")) return "datadome-challenge";
  if (src.includes("captcha")) return "captcha-challenge";
  if (src.includes("perimeterx")) return "perimeterx-challenge";
  if (src.includes("just a moment")) return "anti-bot-interstitial";
  return "challenge-page";
}

/** Map a thrown fetch error onto a FetchOutcome. Used by the dispatcher
 *  to bucket exceptions consistently. */
export function classifyError(err: unknown): FetchOutcome {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("timeout") || err.name === "TimeoutError" || err.name === "AbortError") {
      return { kind: "TIMEOUT", reason: err.name };
    }
    if (
      m.includes("enotfound") ||
      m.includes("econnrefused") ||
      m.includes("econnreset") ||
      m.includes("network") ||
      m.includes("dns")
    ) {
      return { kind: "NETWORK", reason: err.name };
    }
    if (m.includes("403") || m.includes("429") || m.includes("503")) {
      return { kind: "BLOCKED", reason: "thrown-block-status" };
    }
    return { kind: "OTHER", reason: err.name || "Error" };
  }
  return { kind: "OTHER", reason: "non-error-throwable" };
}
