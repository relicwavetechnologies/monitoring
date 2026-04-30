import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
import { AiNoticeCards } from "@/components/dashboard/ai-notice-cards";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TopicCardTile, type TopicCardData } from "@/components/dashboard/topic-card-tile";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";

const HEATMAP_DAYS = 30;

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

async function ActivityPanel() {
  const since = new Date(Date.now() - HEATMAP_DAYS * 24 * 60 * 60 * 1000);

  const sites = await db.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      monitoredUrls: {
        where: { paused: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, url: true },
      },
    },
  });

  const rows = sites.flatMap((s) => {
    if (s.monitoredUrls.length === 0) {
      return [{ siteId: s.id, siteName: s.name, monitoredUrlId: null, urlPath: "(no URLs yet)" }];
    }
    return s.monitoredUrls.map((u) => {
      let urlPath = u.url;
      try {
        urlPath = new URL(u.url).pathname || "/";
      } catch {
        // ignore — keep raw url
      }
      return { siteId: s.id, siteName: s.name, monitoredUrlId: u.id, urlPath };
    });
  });

  if (rows.length === 0) return null;

  const changes = await db.change.findMany({
    where: { detectedAt: { gte: since } },
    select: {
      detectedAt: true,
      severity: true,
      siteId: true,
      monitoredUrlId: true,
    },
    orderBy: { detectedAt: "desc" },
  });

  const points = changes.map((c) => ({
    detectedAt: c.detectedAt.toISOString(),
    severity: c.severity,
    siteId: c.siteId,
    monitoredUrlId: c.monitoredUrlId,
  }));

  return (
    <section className="mb-10 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.008em", color: "var(--foreground-2)" }}>
          Activity
        </h3>
        <span className="pill pill-muted tabular" style={{ fontSize: 11 }}>
          {rows.length} URL{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        style={{
          background: "var(--background-1)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 18px 14px",
        }}
      >
        <ActivityHeatmap rows={rows} changes={points} />
      </div>
    </section>
  );
}

async function CriticalChangesFeed() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const changes = await db.change.findMany({
    where: { detectedAt: { gte: since }, severity: { gte: 4 } },
    orderBy: { detectedAt: "desc" },
    take: 10,
    include: { site: { select: { id: true, name: true, url: true } } },
  });

  if (changes.length === 0) return null;

  return (
    <section className="mb-10 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--red)" }} strokeWidth={2.2} />
          <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.008em", color: "var(--foreground-2)" }}>
            Critical · last 7 days
          </h3>
        </div>
        <span className="pill pill-red tabular" style={{ fontSize: 11 }}>
          {changes.length}
        </span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
        {changes.map((c) => (
          <ChangeCard key={c.id} change={c} />
        ))}
      </div>
    </section>
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

      <Suspense fallback={<Skeleton className="h-72 rounded-xl mb-10" />}>
        <ActivityPanel />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-3 mb-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        }
      >
        <CriticalChangesFeed />
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
