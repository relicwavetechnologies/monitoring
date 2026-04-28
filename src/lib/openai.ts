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
  fast: "gpt-5.4-mini",   // classification (cheap + fast)
  best: "gpt-5.4",         // adapter bootstrap + low-confidence retry
} as const;
