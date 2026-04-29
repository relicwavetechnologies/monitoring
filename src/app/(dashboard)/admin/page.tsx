import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { queueDepth } from "@/lib/queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let depth: Record<string, number> = {};
  try {
    depth = await queueDepth();
  } catch {
    depth = {};
  }

  const [siteCount, urlCount, snapCount, changeCount, sevDist, costSum, recentChanges] = await Promise.all([
    db.site.count({ where: { isActive: true } }),
    db.monitoredUrl.count({ where: { paused: false } }),
    db.snapshot.count(),
    db.change.count(),
    db.change.groupBy({ by: ["severity"], _count: { id: true } }),
    db.change.aggregate({
      where: { detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      _sum: { classifierCostUsd: true, classifierTokensIn: true, classifierTokensOut: true },
      _count: { id: true },
    }),
    db.change.findMany({
      orderBy: { detectedAt: "desc" },
      take: 10,
      select: {
        id: true,
        summary: true,
        severity: true,
        category: true,
        classifierStatus: true,
        classifierModel: true,
        classifierCostUsd: true,
        site: { select: { name: true } },
        detectedAt: true,
      },
    }),
  ]);

  const cost7d = costSum._sum.classifierCostUsd ?? 0;
  const tokensIn7d = costSum._sum.classifierTokensIn ?? 0;
  const tokensOut7d = costSum._sum.classifierTokensOut ?? 0;
  const sevByLevel = Object.fromEntries(sevDist.map((d) => [d.severity, d._count.id]));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational overview. For raw Prometheus counters, see{" "}
          <code className="text-xs">/api/admin/metrics</code>.
        </p>
      </div>

      {/* DB rollups */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Sites", value: siteCount },
          { label: "Active URLs", value: urlCount },
          { label: "Snapshots", value: snapCount.toLocaleString() },
          { label: "Changes", value: changeCount.toLocaleString() },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border/50">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-base font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Queue depth</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(depth).length === 0 && (
            <p className="text-xs text-muted-foreground col-span-full">
              Queue is unreachable or not started yet (DATABASE_URL may be missing).
            </p>
          )}
          {Object.entries(depth).map(([name, n]) => (
            <div key={name} className="border rounded-md px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-mono">
                {name}
              </div>
              <div className="text-base font-semibold">{n < 0 ? "—" : n}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cost rollup */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-md px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
              Changes
            </div>
            <div className="text-base font-semibold">{costSum._count.id}</div>
          </div>
          <div className="border rounded-md px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
              LLM cost
            </div>
            <div className="text-base font-semibold">${cost7d.toFixed(4)}</div>
          </div>
          <div className="border rounded-md px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
              Tokens in
            </div>
            <div className="text-base font-semibold">{tokensIn7d.toLocaleString()}</div>
          </div>
          <div className="border rounded-md px-3 py-2">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
              Tokens out
            </div>
            <div className="text-base font-semibold">{tokensOut7d.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      {/* Severity distribution */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Severity distribution (all-time)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((sev) => (
            <div key={sev} className="border rounded-md px-3 py-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">sev {sev}</div>
              <div className="text-base font-semibold">{sevByLevel[sev] ?? 0}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent changes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent changes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentChanges.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes yet.</p>
          ) : (
            <div className="space-y-2">
              {recentChanges.map((c) => (
                <div key={c.id} className="text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    sev {c.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {c.classifierStatus}
                  </Badge>
                  <span className="font-mono text-muted-foreground">{c.site.name}</span>
                  <span className="flex-1 truncate">{c.summary}</span>
                  {c.classifierCostUsd != null && (
                    <span className="text-muted-foreground font-mono">
                      ${c.classifierCostUsd.toFixed(5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
