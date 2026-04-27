import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function verifyCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all active sites due for a check
  const sites = await db.site.findMany({
    where: {
      isActive: true,
      OR: [
        { lastCheckedAt: null },
        {
          lastCheckedAt: {
            lte: new Date(now.getTime() - 1 * 60 * 1000), // safety: at least 1 min ago
          },
        },
      ],
    },
    select: { id: true, lastCheckedAt: true, pollIntervalMin: true },
  });

  const due = sites.filter((s) => {
    if (!s.lastCheckedAt) return true;
    const nextPoll = new Date(s.lastCheckedAt.getTime() + s.pollIntervalMin * 60 * 1000);
    return now >= nextPoll;
  });

  // Fan out — fire-and-forget each poll
  const baseUrl = req.nextUrl.origin;

  await Promise.allSettled(
    due.map((site) =>
      fetch(`${baseUrl}/api/cron/poll/${site.id}`, {
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    )
  );

  return NextResponse.json({ triggered: due.length, siteIds: due.map((s) => s.id) });
}
