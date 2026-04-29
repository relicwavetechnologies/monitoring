import OpenAI from "openai";

// Uses your gateway — compatible with the OpenAI SDK via custom baseURL.
// Proxy so callers keep using `openai.foo.bar(...)` while the underlying
// client is constructed lazily at first access (avoids build-time crashes
// when OPENAI_API_KEY isn't present during `next build`).
const globalForOpenAI = globalThis as unknown as { openai?: OpenAI };

function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://gateway-v21w.onrender.com/v1",
  });
}

export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) {
    if (!globalForOpenAI.openai) globalForOpenAI.openai = makeClient();
    const client = globalForOpenAI.openai as unknown as Record<string | symbol, unknown>;
    return client[prop as string];
  },
});

// Model aliases — overridable via env so the gateway can swap providers
// without a deploy. Defaults match what the gateway exposes today.
export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST ?? "gemini-3-flash-lite-preview",
  best: process.env.OPENAI_MODEL_BEST ?? "gemini-3-flash-preview",
  gemini: process.env.OPENAI_MODEL_GEMINI ?? "gemini-3-flash-preview",
} as const;

/**
 * Per-million-token pricing in USD. The map is checked by exact model name
 * first, then by prefix, then defaults to a conservative estimate. Values
 * are rough; the goal is approximate cost accounting, not invoicing.
 */
const COST_PER_MILLION: Array<{ match: string | RegExp; input: number; output: number }> = [
  { match: "gemini-3-flash-lite-preview",    input: 0.075, output: 0.30 },
  { match: "gemini-3-flash-preview",         input: 0.30,  output: 1.20 },
  { match: /^gpt-5/i,                        input: 2.50,  output: 10.00 },
  { match: /^claude-opus/i,                  input: 15.00, output: 75.00 },
  { match: /^claude-sonnet/i,                input: 3.00,  output: 15.00 },
];

const FALLBACK_COST = { input: 0.50, output: 2.00 };

export function modelCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const entry = COST_PER_MILLION.find((e) =>
    typeof e.match === "string" ? e.match === model : e.match.test(model)
  );
  const rate = entry ?? FALLBACK_COST;
  return (tokensIn * rate.input + tokensOut * rate.output) / 1_000_000;
}
