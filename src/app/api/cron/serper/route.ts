import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchSerper } from "@/lib/serper";

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const VISA_QUERIES = [
  "visa appointment fee changes site:vfsglobal.com",
  "visa requirements updated site:gov.uk",
  "US visa appointment india site:in.usembassy.gov",
  "singapore visa requirements site:ica.gov.sg",
  "visa policy change announcement 2024 2025",
];

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled(
    VISA_QUERIES.map(async (query) => {
      const hits = await searchSerper(query, 5);

      for (const hit of hits) {
        await db.serperHit
          .upsert({
            where: { query_url: { query, url: hit.link } },
            create: {
              query,
              url: hit.link,
              title: hit.title,
              snippet: hit.snippet,
              publishedAt: hit.date ? new Date(hit.date) : null,
            },
            update: {
              title: hit.title,
              snippet: hit.snippet,
            },
          })
          .catch(() => null); // ignore unique constraint on duplicate
      }

      return hits.length;
    })
  );

  const total = results.reduce(
    (acc, r) => acc + (r.status === "fulfilled" ? r.value : 0),
    0
  );

  return NextResponse.json({ saved: total });
}
