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

// Model aliases — map to your gateway's available models
export const MODELS = {
  fast: "gemini-3-flash-lite-preview",  // classification — fast + cheap
  best: "gemini-3-flash-lite-preview",  // low-confidence retry (same tier, escalate if needed)
  gemini: "gemini-3-flash-preview",     // site analysis — large context, smarter
} as const;
