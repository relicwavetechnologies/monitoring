import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
import { AiNoticeCards } from "@/components/dashboard/ai-notice-cards";
import { EmptyState } from "@/components/dashboard/empty-state";
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
      {stats.map(({ n, label, sub }, i) => (
        <div
          key={label}
          className={`surface-raised animate-fade-up stagger-${i + 1}`}
          style={{ padding: "20px 22px" }}
        >
          <div className="stat-number-lg">{n.toLocaleString()}</div>
          <div
            className="text-footnote-em mt-3"
            style={{ color: "var(--foreground)" }}
          >
            {label}
          </div>
          <div
            className="text-footnote mt-0.5"
            style={{ color: "var(--foreground-3)" }}
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
      <EmptyState
        icon={CheckCircle2}
        size="spacious"
        title="No changes detected yet"
        description="Add a site and trigger a poll to get started."
      />
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
    <div className="flex items-baseline justify-between mb-3.5">
      <h3 className="text-headline" style={{ color: "var(--foreground)" }}>
        {label}
      </h3>
      <span className={`pill ${accent ? "pill-blue" : "pill-muted"} tabular`}>
        {count}
      </span>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10 animate-fade-up">
        <span className="eyebrow inline-block mb-3">Dashboard</span>
        <h1 className="hero-title">Overview</h1>
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
