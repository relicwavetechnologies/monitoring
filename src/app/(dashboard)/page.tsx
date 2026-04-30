import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
import { AiNoticeCards } from "@/components/dashboard/ai-notice-cards";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TopicCardTile, type TopicCardData } from "@/components/dashboard/topic-card-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

async function StatsRow() {
  const [totalSites, activeSites, totalChanges, highSeverity, totalUrls] = await Promise.all([
    db.site.count(),
    db.site.count({ where: { isActive: true } }),
    db.change.count(),
    db.change.count({ where: { severity: { gte: 3 } } }),
    db.monitoredUrl.count({ where: { paused: false } }),
  ]);

  const stats = [
    { n: totalSites,   label: "Sites monitored",  sub: `${activeSites} active`,         href: "/sites" },
    { n: totalUrls,    label: "URLs tracked",      sub: "across all sites",               href: "/sites" },
    { n: totalChanges, label: "Changes detected",  sub: "all time",                       href: "/" },
    { n: highSeverity, label: "High severity",     sub: "severity 3 or above",            href: "/" },
  ];

  return (
    <div
      className="animate-fade-up mb-8"
      style={{
        background: "var(--background-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
      }}
    >
      {stats.map(({ n, label, sub, href }, i) => (
        <Link
          key={label}
          href={href}
          className="stat-col"
          style={{
            padding: "22px 24px",
            borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <span
            style={{ fontSize: 11.5, fontWeight: 500, color: "var(--foreground-4)", letterSpacing: "0.01em", marginBottom: 10 }}
          >
            {label.toUpperCase()}
          </span>
          <span
            style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
          >
            {n.toLocaleString()}
          </span>
          <div className="flex items-center justify-between mt-3">
            <span style={{ fontSize: 12, color: "var(--foreground-4)" }}>{sub}</span>
            <ArrowRight
              className="stat-col-arrow h-3.5 w-3.5"
              strokeWidth={2}
              style={{ color: "var(--foreground-3)" }}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

async function ChangedCards() {
  // Phase 8: surface MonitoredUrls whose topic card has a lastChangeNote
  // populated. These are the cards the user should look at right now.
  const urls = await db.monitoredUrl.findMany({
    where: { topicCardAt: { not: null } },
    orderBy: { topicCardAt: "desc" },
    take: 12,
    select: {
      id: true,
      url: true,
      topicCard: true,
      paused: true,
      lastFailureKind: true,
      consecutiveFailures: true,
      lastCheckedAt: true,
      site: { select: { id: true, name: true } },
    },
  });

  const withChange = urls.filter((u) => {
    const c = u.topicCard as Prisma.JsonValue as TopicCardData | null;
    return c?.lastChangeNote;
  });

  if (withChange.length === 0) return null;

  return (
    <section className="mb-10">
      <SectionHead label="Recently changed" count={withChange.length} accent />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {withChange.map((u) => (
          <TopicCardTile
            key={u.id}
            urlId={u.id}
            url={u.url}
            card={(u.topicCard as Prisma.JsonValue as TopicCardData | null) ?? null}
            paused={u.paused}
            failureKind={u.lastFailureKind}
            consecutiveFailures={u.consecutiveFailures}
            lastCheckedAt={u.lastCheckedAt}
          />
        ))}
      </div>
    </section>
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
          <div className="grid gap-3 mb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        }
      >
        <ChangedCards />
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
