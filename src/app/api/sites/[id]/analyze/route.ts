import { NextRequest, NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { openai, MODELS } from "@/lib/openai";

const SYSTEM_PROMPT = `You are a visa application expert. You have been given the full text content of a government or embassy website — crawled across multiple pages and organized by page path.

Your task: Read through ALL pages and extract everything important for a visa applicant. Synthesize across pages — do not repeat the same fact multiple times.

Structure your output in clean markdown with these sections (only include sections that have relevant content):

## 💰 Fees
All visa fees, payment methods, service charges — with specific amounts and which visa types they apply to.

## 📋 Document Requirements
Every required document, form, supporting material. Group by visa type if applicable.

## 🗓️ Appointments & Processing
How to book, available slots, wait times, processing times, office hours.

## 📜 Eligibility & Rules
Who can apply, restrictions, validity periods, entry conditions, extension rules.

## ⚠️ Important Notices
Active warnings, suspensions, temporary measures, urgent policy changes, scam alerts.

## 🔗 Key Pages Found
List the most useful sub-pages discovered, with their path and a one-line description.

## ℹ️ Contact & Other Info
Contact details, addresses, phone numbers, social media, anything else useful.

Be specific and actionable. Only state what is actually in the content. Skip sections with nothing relevant.`;

// Keywords that signal visa-relevant content — higher score = more budget
const VISA_KEYWORDS = [
  "visa", "fee", "appointment", "document", "passport", "application",
  "require", "eligib", "processing", "interview", "booking", "wait time",
  "checklist", "form", "biometric", "ds-160", "permit", "residence",
  "nonimmigrant", "immigrant", "tourist", "business visa", "student visa",
  "work visa", "extension", "renewal", "schedule", "consulate", "embassy",
];

function visaScore(text: string): number {
  const lower = text.slice(0, 2000).toLowerCase();
  return VISA_KEYWORDS.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0);
}

/**
 * Parse the aggregated snapshot text back into per-page sections,
 * re-sort them by visa relevance (highest first), then rebuild within budget.
 *
 * The snapshot stores pages as:
 *   === /path | Page Title ===\n<content>\n\n=== /path2 ...
 */
function buildRelevanceSortedContent(fullText: string, charBudget = 80_000): string {
  // Split on section headers — keep the header with its content
  const sectionRe = /(?=^=== \/)/m;
  const rawSections = fullText.split(sectionRe).filter((s) => s.trim());

  if (rawSections.length <= 1) {
    // Single-page snapshot or old format — just truncate
    return fullText.slice(0, charBudget);
  }

  // Parse each section into { header, path, content, score }
  const sections = rawSections.map((raw) => {
    const headerEnd = raw.indexOf("\n");
    const header = raw.slice(0, headerEnd).trim();           // === /visas | Visas ===
    const content = raw.slice(headerEnd + 1).trim();

    // Extract path from header: === /path | title ===
    const pathMatch = header.match(/^=== (\/[^\s|]*)/);
    const path = pathMatch?.[1] ?? "/";

    return { header, path, content, score: visaScore(content) };
  });

  // Sort: root page always first, then by visa relevance score desc
  sections.sort((a, b) => {
    if (a.path === "/" || a.path === new URL("", "http://x").pathname) return -1;
    if (b.path === "/" || b.path === new URL("", "http://x").pathname) return 1;
    return b.score - a.score;
  });

  // Rebuild within budget — high-relevance pages get up to 6k chars each,
  // low-relevance pages get up to 2k
  const blocks: string[] = [];
  let used = 0;

  for (const sec of sections) {
    if (used >= charBudget) break;
    const remaining = charBudget - used;
    const pageCap = sec.score >= 3 ? Math.min(6000, remaining) : Math.min(2000, remaining);
    const excerpt = sec.content.slice(0, pageCap);
    const truncNote = sec.content.length > pageCap
      ? `\n[... ${sec.content.length - pageCap} more chars on this page ...]`
      : "";

    const block = `${sec.header}\n${excerpt}${truncNote}`;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

// Models allowed to be selected from the UI — prevent arbitrary model injection
const ALLOWED_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-3-flash-lite-preview",
  "gpt-5.4",
  "gpt-5.4-mini",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Read chosen model from request body, fall back to default
  let chosenModel: string = MODELS.gemini;
  try {
    const body = await req.json();
    if (body?.model && ALLOWED_MODELS.has(body.model)) {
      chosenModel = body.model;
    }
  } catch { /* no body or invalid JSON — use default */ }

  const site = await db.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // Read the latest snapshot's aggregated text (set by the poll crawl)
  const snapshot = await db.snapshot.findFirst({
    where: { siteId: id },
    orderBy: { fetchedAt: "desc" },
    select: { textGz: true, htmlGz: true, fetchedAt: true },
  });

  if (!snapshot?.textGz) {
    return NextResponse.json(
      { error: "No snapshot yet — poll this site first to capture content." },
      { status: 400 }
    );
  }

  const fullText = gunzipSync(Buffer.from(snapshot.textGz)).toString("utf8");

  if (!fullText.trim()) {
    return NextResponse.json(
      { error: "Snapshot content is empty — try polling again." },
      { status: 400 }
    );
  }

  // Parse crawl manifest for metadata
  let pagesCrawled = 1;
  let isFallback = false;
  try {
    if (snapshot.htmlGz) {
      const manifest = JSON.parse(
        gunzipSync(Buffer.from(snapshot.htmlGz)).toString("utf8")
      );
      pagesCrawled = manifest.pagesCrawled ?? 1;
      isFallback = manifest.fallback === true;
    }
  } catch { /* old-format snapshot — fine */ }

  // Re-sort sections by visa relevance — large budget since Gemini has massive context
  const sortedContent = buildRelevanceSortedContent(fullText, 400_000);

  const userMessage = [
    `Site: ${site.name}`,
    `Root URL: ${site.url}`,
    `Pages in snapshot: ${pagesCrawled}${isFallback ? " (single-page fallback — site blocks crawlers)" : ""}`,
    `Snapshot captured: ${snapshot.fetchedAt.toISOString()}`,
    ``,
    `--- CONTENT START ---`,
    sortedContent,
    `--- CONTENT END ---`,
  ].join("\n");

  const res = await openai.chat.completions.create({
    model: chosenModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const analysis = res.choices[0].message.content ?? "No analysis returned.";
  const statsHeader = `> 🕷️ Analyzed snapshot from **${snapshot.fetchedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}** — **${pagesCrawled} page${pagesCrawled !== 1 ? "s" : ""}** crawled${isFallback ? " *(single-page fallback)*" : ""} · \`${chosenModel}\`\n\n`;
  const finalAnalysis = statsHeader + analysis;

  await db.site.update({
    where: { id },
    data: { aiAnalysis: finalAnalysis, aiAnalysisAt: new Date() },
  });

  return NextResponse.json({
    analysis: finalAnalysis,
    pagesCrawled,
    analyzedAt: new Date().toISOString(),
  });
}
