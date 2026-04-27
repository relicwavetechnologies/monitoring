import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { Globe, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function StatsRow() {
  const [totalSites, activeSites, totalChanges, highSeverity] = await Promise.all([
    db.site.count(),
    db.site.count({ where: { isActive: true } }),
    db.change.count(),
    db.change.count({ where: { severity: { gte: 3 } } }),
  ]);

  const stats = [
    { label: "Monitored Sites", value: totalSites, icon: Globe, sub: `${activeSites} active` },
    { label: "Total Changes", value: totalChanges, icon: TrendingUp, sub: "all time" },
    {
      label: "Notable Changes",
      value: highSeverity,
      icon: AlertTriangle,
      sub: "severity ≥ 3",
    },
    {
      label: "Sites OK",
      value: activeSites,
      icon: CheckCircle2,
      sub: "no recent issues",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map(({ label, value, icon: Icon, sub }) => (
        <Card key={label} className="bg-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RecentChanges() {
  const changes = await db.change.findMany({
    orderBy: { detectedAt: "desc" },
    take: 20,
    include: { site: { select: { id: true, name: true, url: true } } },
  });

  const significant = changes.filter((c) => c.severity >= 3);
  const minor = changes.filter((c) => c.severity < 3);

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-lg font-medium">No changes detected yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add a site and trigger a poll to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {significant.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold">Significant Changes</h2>
            <Badge className="bg-amber-950 text-amber-400 border-amber-800 text-[11px]">
              {significant.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {significant.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}

      {minor.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Minor / Cosmetic</h2>
          <div className="space-y-2">
            {minor.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All changes detected across your monitored visa sites
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <StatsRow />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <RecentChanges />
      </Suspense>
    </div>
  );
}
