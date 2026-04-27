import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchSite } from "@/lib/pipeline/fetch";
import { bootstrapAdapter } from "@/lib/adapters/bootstrap";
import { extractContent } from "@/lib/pipeline/extract";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Try static first; if content looks thin, try JS
  let result = await fetchSite(url, "STATIC");

  // Heuristic: if static HTML is too small, likely a SPA
  const suggestJs = result.html.length < 3000;

  const draft = await bootstrapAdapter(url, result.html);

  // Also return a preview of what the extracted text looks like
  const preview = extractContent(result.html, draft.contentSelector, draft.stripPatterns);

  return NextResponse.json({
    draft,
    preview: preview.slice(0, 2000),
    suggestJs,
    htmlLength: result.html.length,
  });
}
