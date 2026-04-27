import { openai, MODELS } from "@/lib/openai";
import { z } from "zod";

const AdapterDraftSchema = z.object({
  name: z.string(),
  contentSelector: z.string(),
  stripPatterns: z.array(z.string()),
  pollIntervalMin: z.number().int().min(15).max(1440),
  renderMode: z.enum(["STATIC", "JS"]),
  reasoning: z.string(),
});

export type AdapterDraft = z.infer<typeof AdapterDraftSchema>;

export async function bootstrapAdapter(url: string, html: string): Promise<AdapterDraft> {
  const truncated = html.slice(0, 28000);

  const response = await openai.chat.completions.create({
    model: MODELS.best,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing government and visa-application websites to identify where policy changes, fee updates, appointment availability, and important news appear.

Your job: given the HTML of a visa-related page, return a JSON object that describes how to monitor it for meaningful changes.

Rules:
- contentSelector: a CSS selector targeting ONLY the region that contains visa policy/news/fee/appointment content. Avoid headers, footers, navs, sidebars, cookie banners. Prefer specific selectors over "body". Examples: "main", ".content-area", "#visa-news", "article".
- stripPatterns: JavaScript regex SOURCES (no slashes or flags) to remove noise before hashing — things like dates, times, session IDs, CSRF tokens, view counters, "last updated" timestamps. Max 8 patterns.
- pollIntervalMin: how often to check in minutes. Government embassy pages change rarely (360-720). VFS appointment pages change frequently (15-30). General visa info pages: 60-180.
- renderMode: "STATIC" if the page is server-rendered HTML, "JS" if it's a React/Vue/Angular SPA that requires JavaScript execution.
- name: a short human-readable name for this site (e.g. "US Embassy Mumbai", "VFS UK Visa UAE").
- reasoning: 1-2 sentences explaining your selector choice.`,
      },
      {
        role: "user",
        content: `URL: ${url}\n\nHTML (truncated):\n${truncated}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = JSON.parse(response.choices[0].message.content ?? "{}");
  return AdapterDraftSchema.parse(raw);
}
