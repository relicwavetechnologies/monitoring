import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
import { AiNoticeCards } from "@/components/dashboard/ai-notice-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";

async function StatsRow() {
  const [totalSites, activeSites, totalChanges, highSeverity] = await Promise.all([
    db.site.count(),
    db.site.count({ where: { isActive: true } }),
    db.change.count(),
    db.change.count({ where: { severity: { gte: 3 } } }),
  ]);

  const stats = [
    { n: totalSites,   label: "Monitored sites", sub: `${activeSites} active` },
    { n: totalChanges, label: "Total changes",   sub: "all time" },
    { n: highSeverity, label: "Notable changes", sub: "severity ≥ 3" },
    { n: activeSites,  label: "Sites OK",        sub: "no recent issues" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
      {stats.map(({ n, label, sub }) => (
        <div
          key={label}
          className="surface-raised p-5 animate-fade-up"
        >
          <div className="stat-number">{n.toLocaleString()}</div>
          <div
            className="mt-2"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--foreground)",
              letterSpacing: "-0.011em",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--foreground-3)",
              marginTop: 1,
              letterSpacing: "-0.005em",
            }}
          >
            {sub}
          </div>
        </div>
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
      <div
        className="flex flex-col items-center justify-center py-24 text-center surface-flat"
        style={{ borderStyle: "dashed" }}
      >
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
          style={{ background: "var(--background-2)" }}
        >
          <CheckCircle2
            className="h-6 w-6"
            strokeWidth={1.6}
            style={{ color: "var(--foreground-4)" }}
          />
        </div>
        <p
          className="text-base font-semibold"
          style={{ color: "var(--foreground)", letterSpacing: "-0.014em" }}
        >
          No changes detected yet
        </p>
        <p
          className="mt-1.5"
          style={{ color: "var(--foreground-3)", fontSize: 14, letterSpacing: "-0.005em" }}
        >
          Add a site and trigger a poll to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {significant.length > 0 && (
        <section>
          <SectionHead label="Significant" count={significant.length} accent />
          <div className="surface-flat overflow-hidden">
            {significant.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}

      {minor.length > 0 && (
        <section>
          <SectionHead label="Minor / cosmetic" count={minor.length} />
          <div className="surface-flat overflow-hidden">
            {minor.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHead({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "-0.018em",
          color: "var(--foreground)",
        }}
      >
        {label}
      </h3>
      <span
        className={`pill ${accent ? "pill-blue" : "pill-muted"} tabular`}
      >
        {count}
      </span>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Hero */}
      <div className="mb-10 animate-fade-up">
        <span className="eyebrow mb-3 inline-block">Dashboard</span>
        <h1 className="hero-title mt-2">Overview</h1>
        <p className="hero-sub mt-3 max-w-2xl">
          Every visa-related change detected across your monitored sites — sorted by what matters.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <StatsRow />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-3 mb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <AiNoticeCards />
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
