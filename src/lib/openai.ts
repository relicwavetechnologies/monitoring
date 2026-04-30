import OpenAI from "openai";

// Uses your gateway — compatible with the OpenAI SDK via custom baseURL.
// Proxy so callers keep using `openai.foo.bar(...)` while the underlying
// client is constructed lazily at first access (avoids build-time crashes
// when OPENAI_API_KEY isn't present during `next build`).
const globalForOpenAI = globalThis as unknown as { openai?: OpenAI };

/**
 * Routing logic in priority order:
 *   1. GEMINI_API_KEY  → Google's OpenAI-compatible endpoint (free/cheap, fast).
 *   2. OPENAI_API_KEY starts with sk-  → real OpenAI directly.
 *   3. OPENAI_API_KEY starts with cnsc_gw_  → custom gateway from OPENAI_BASE_URL.
 *   4. Anything else  → fall back to OPENAI_BASE_URL or the legacy gateway URL.
 */
function makeClient(): OpenAI {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return new OpenAI({
      apiKey: geminiKey,
      baseURL:
        process.env.GEMINI_BASE_URL ??
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const looksLikeOpenAI = !!apiKey && apiKey.startsWith("sk-");
  const baseURL = looksLikeOpenAI
    ? undefined // SDK default: https://api.openai.com/v1
    : process.env.OPENAI_BASE_URL ?? "https://gateway-v21w.onrender.com/v1";
  return new OpenAI({ apiKey, baseURL });
}

export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) {
    if (!globalForOpenAI.openai) globalForOpenAI.openai = makeClient();
    const client = globalForOpenAI.openai as unknown as Record<string | symbol, unknown>;
    return client[prop as string];
  },
});

// Model aliases. Resolved lazily on first access so dotenv-loaded env vars
// are visible by the time the value is read (ESM imports otherwise hoist
// before any side-effectful dotenv.config() call in the entrypoint).
function pickDefaults(): { fast: string; best: string } {
  if (process.env.GEMINI_API_KEY) {
    // Google's OpenAI-compat endpoint. Note: only the dotted form
    // ("gemini-3.1-flash-lite-preview") is served on /v1beta/openai; the
    // dashed alias returns 404.
    return { fast: "gemini-3.1-flash-lite-preview", best: "gemini-3-flash-preview" };
  }
  if (process.env.OPENAI_API_KEY?.startsWith("sk-")) {
    return { fast: "gpt-4o-mini", best: "gpt-4o" };
  }
  // Legacy gateway defaults.
  return { fast: "gemini-3-flash-lite-preview", best: "gemini-3-flash-preview" };
}

// Backed by a Proxy so each property read resolves env vars at *that* moment.
export const MODELS = new Proxy(
  {} as { fast: string; best: string; gemini: string },
  {
    get(_, prop: string) {
      const d = pickDefaults();
      if (prop === "fast") return process.env.OPENAI_MODEL_FAST ?? d.fast;
      if (prop === "best") return process.env.OPENAI_MODEL_BEST ?? d.best;
      if (prop === "gemini") return process.env.OPENAI_MODEL_GEMINI ?? d.best;
      return undefined;
    },
  }
);

/**
 * Per-million-token pricing in USD. The map is checked by exact model name
 * first, then by prefix, then defaults to a conservative estimate. Values
 * are rough; the goal is approximate cost accounting, not invoicing.
 */
const COST_PER_MILLION: Array<{ match: string | RegExp; input: number; output: number }> = [
  { match: "gemini-3-flash-lite-preview",    input: 0.075, output: 0.30 },
  { match: "gemini-3.1-flash-lite-preview",  input: 0.075, output: 0.30 },
  { match: "gemini-3-flash-preview",         input: 0.30,  output: 1.20 },
  { match: /^gemini-2\.0-flash/i,            input: 0.10,  output: 0.40 },
  { match: /^gemini-2\.5-pro/i,              input: 1.25,  output: 10.00 },
  { match: /^gemini-2\.5-flash/i,            input: 0.30,  output: 2.50 },
  { match: /^gemini-1\.5-pro/i,              input: 1.25,  output: 5.00 },
  { match: /^gemini-1\.5-flash/i,            input: 0.075, output: 0.30 },
  { match: /^gpt-4o-mini/i,                  input: 0.15,  output: 0.60 },
  { match: /^gpt-4o/i,                       input: 2.50,  output: 10.00 },
  { match: /^gpt-5/i,                        input: 2.50,  output: 10.00 },
  { match: /^claude-opus/i,                  input: 15.00, output: 75.00 },
  { match: /^claude-sonnet/i,                input: 3.00,  output: 15.00 },
  { match: /^text-embedding-3-small/i,       input: 0.02,  output: 0 },
  { match: /^text-embedding-3-large/i,       input: 0.13,  output: 0 },
];

const FALLBACK_COST = { input: 0.50, output: 2.00 };

/**
 * Parse JSON from an LLM response, stripping markdown code fences if present.
 * Gemini and other models sometimes wrap JSON in ```json ... ``` even when
 * response_format: json_object is requested.
 */
export function parseJsonSafe(raw: string | null | undefined): unknown {
  const s = (raw ?? "{}").trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const stripped = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(stripped);
}

export function modelCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const entry = COST_PER_MILLION.find((e) =>
    typeof e.match === "string" ? e.match === model : e.match.test(model)
  );
  const rate = entry ?? FALLBACK_COST;
  return (tokensIn * rate.input + tokensOut * rate.output) / 1_000_000;
}
