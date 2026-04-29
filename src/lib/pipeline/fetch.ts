/**
 * Phase 4: this file is now a thin facade over `fetchers/index.ts`. It
 * exists so existing callers (`crawl.ts`, the bootstrap route, the demo
 * scripts) keep compiling without a churny rename. New code should call
 * `dispatchFetch` directly.
 */
import { dispatchFetch } from "./fetchers";
import type { RenderMode, FetchMode } from "@/generated/prisma/enums";

export interface FetchResult {
  html: string;
  status: number;
}

/** Translate the legacy two-value RenderMode into the four-tier FetchMode. */
function renderModeToFetchMode(mode: RenderMode): FetchMode {
  return mode === "JS" ? "PLAYWRIGHT" : "STATIC";
}

export async function fetchSite(url: string, mode: RenderMode): Promise<FetchResult> {
  const result = await dispatchFetch({ url, mode: renderModeToFetchMode(mode) });
  return { html: result.html, status: result.status };
}
