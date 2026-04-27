import OpenAI from "openai";

// Uses your gateway — compatible with the OpenAI SDK via custom baseURL
const globalForOpenAI = globalThis as unknown as { openai: OpenAI };

export const openai =
  globalForOpenAI.openai ||
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://gateway-v21w.onrender.com/v1",
  });

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai;

// Model aliases — map to your gateway's available models
export const MODELS = {
  fast: "gpt-5.4-mini",   // classification (cheap + fast)
  best: "gpt-5.4",         // adapter bootstrap + low-confidence retry
} as const;
