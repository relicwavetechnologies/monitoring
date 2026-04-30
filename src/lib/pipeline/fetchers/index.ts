/**
 * Fetcher dispatcher. Picks the right tier based on `MonitoredUrl.fetchMode`,
 * runs the fetch under the per-host semaphore, classifies the outcome, and
 * returns a structured result the dispatcher's caller can react to.
 *
 * The dispatcher is the *only* place that knows about the four tiers —
 * everywhere else (run-poll, the legacy fetchSite shim, the cron tick) just
 * dispatches by passing a fetchMode.
 */
import { fetchStatic } from "./static";
import { fetchPlaywright } from "./playwright";
import { fetchStealth } from "./stealth";
import { fetchCamoufox } from "./camoufox";
import { fetchExternal } from "./external";
import { withHostLock } from "./host-semaphore";
import {
  classifyResponse,
  classifyError,
  type FetchOutcome,
  type FetchOutcomeKind,
} from "./block-detection";
import type { FetchMode } from "@/generated/prisma/enums";

export interface DispatchResult {
  /** What we got back (might still be unusable — check outcome). */
  html: string;
  status: number;
  /** Outcome classification. OK means usable. */
  outcome: FetchOutcome;
  /** Wall-clock duration of the actual fetch, in milliseconds. */
  durationMs: number;
  /** Phase 8: optional viewport screenshot (PNG bytes). Only set by JS-rendering tiers. */
  screenshot?: Buffer;
}

/** Run a fetch using the right tier. Always resolves; errors are folded
 *  into the outcome so the caller writes one branchless code path. */
export async function dispatchFetch(input: {
  url: string;
  mode: FetchMode;
}): Promise<DispatchResult> {
  const host = safeHost(input.url);

  return withHostLock(host, async () => {
    const start = Date.now();
    try {
      const raw = await runForMode(input.mode, input.url);
      const outcome = classifyResponse(raw);
      return {
        html: raw.html,
        status: raw.status,
        outcome,
        durationMs: Date.now() - start,
        screenshot: raw.screenshot,
      };
    } catch (err) {
      return {
        html: "",
        status: 0,
        outcome: classifyError(err),
        durationMs: Date.now() - start,
      };
    }
  });
}

async function runForMode(
  mode: FetchMode,
  url: string
): Promise<{ html: string; status: number; screenshot?: Buffer }> {
  switch (mode) {
    case "STATIC":
      return fetchStatic(url);
    case "PLAYWRIGHT":
      return fetchPlaywright(url);
    case "STEALTH":
      return fetchStealth(url);
    case "CAMOUFOX":
      return fetchCamoufox(url);
    case "EXTERNAL":
      return fetchExternal(url);
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown-host";
  }
}

export type { FetchOutcome, FetchOutcomeKind };
