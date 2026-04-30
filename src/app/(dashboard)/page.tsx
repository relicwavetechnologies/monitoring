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
          className={`card-item animate-fade-up stagger-${i + 1}`}
        >
          <div className="stat-block-value">{n.toLocaleString()}</div>
          <div
            className="mt-3"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.011em" }}
          >
            {label}
          </div>
          <div className="stat-block-label mt-0.5">{sub}</div>
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
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {significant.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}

      {minor.length > 0 && (
        <section>
          <SectionHead label="Minor / cosmetic" count={minor.length} />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
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
    <div className="flex items-center justify-between mb-3">
      <h3
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.008em", color: "var(--foreground-2)" }}
      >
        {label}
      </h3>
      <span className="pill pill-muted tabular" style={{ fontSize: 11 }}>
        {count}
      </span>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8 animate-fade-up">
        <h1 className="hero-title">Overview</h1>
        <p className="hero-sub mt-1">
          Visa-related changes across all monitored sites, sorted by severity.
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
