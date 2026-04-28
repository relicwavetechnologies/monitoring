import { db } from "@/lib/db";
import { ChangeCard } from "@/components/dashboard/change-card";
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
    { n: totalSites,   label: "Monitored sites",   sub: `${activeSites} active` },
    { n: totalChanges, label: "Total changes",      sub: "all time" },
    { n: highSeverity, label: "Notable changes",    sub: "severity ≥ 3" },
    { n: activeSites,  label: "Sites OK",           sub: "no recent issues" },
  ];

  return (
    /* Doc hero-stats: grid with 1px gap on --line bg */
    <div
      className="grid grid-cols-2 lg:grid-cols-4 mb-10"
      style={{
        gap: 1,
        background: "var(--border, #E8E8F2)",
        border: "1px solid var(--border, #E8E8F2)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {stats.map(({ n, label, sub }) => (
        <div
          key={label}
          style={{ background: "var(--background-1, #F5F5FC)", padding: "22px 20px" }}
        >
          {/* Italic serif number in accent */}
          <div
            style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 34,
              fontStyle: "italic",
              color: "#6C63FF",
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            {n}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.10em",
              color: "var(--foreground-3, #9494B0)",
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 11, color: "var(--foreground-3, #9494B0)" }}>{sub}</div>
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
        className="flex flex-col items-center justify-center py-24 text-center border border-dashed rounded-md"
        style={{ borderColor: "var(--border, #E8E8F2)", color: "var(--foreground-3, #9494B0)" }}
      >
        <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: "var(--border-2, #D4D4E8)" }} />
        <p className="text-base font-semibold" style={{ color: "var(--foreground, #0D0D1C)" }}>No changes detected yet</p>
        <p className="text-sm mt-1">Add a site and trigger a poll to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {significant.length > 0 && (
        <section>
          {/* Doc pipeline-header style */}
          <div
            style={{
              background: "var(--background-1, #F5F5FC)",
              borderTop: "1px solid var(--border, #E8E8F2)",
              borderLeft: "1px solid var(--border, #E8E8F2)",
              borderRight: "1px solid var(--border, #E8E8F2)",
              borderRadius: "6px 6px 0 0",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--foreground-3, #9494B0)" }}>
              Significant changes
            </span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#6C63FF" }}>
              {significant.length}
            </span>
          </div>
          {/* List container — doc pipeline border */}
          <div style={{ border: "1px solid var(--border, #E8E8F2)", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
            {significant.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      )}

      {minor.length > 0 && (
        <section>
          <div
            style={{
              background: "var(--background-1, #F5F5FC)",
              borderTop: "1px solid var(--border, #E8E8F2)",
              borderLeft: "1px solid var(--border, #E8E8F2)",
              borderRight: "1px solid var(--border, #E8E8F2)",
              borderRadius: "6px 6px 0 0",
              padding: "10px 16px",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--foreground-3, #9494B0)" }}>
              Minor / Cosmetic
            </span>
          </div>
          <div style={{ border: "1px solid var(--border, #E8E8F2)", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
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
      <div className="mb-8">
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#6C63FF",
            marginBottom: 10,
          }}
        >
          Dashboard
        </div>
        <h1
          style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 40,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            color: "var(--foreground, #0D0D1C)",
            marginBottom: 8,
          }}
        >
          Overview
        </h1>
        <p style={{ fontSize: 15, color: "var(--foreground-2, #5A5A7A)" }}>
          All changes detected across your monitored visa sites.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-none" />
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
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        }
      >
        <RecentChanges />
      </Suspense>
    </div>
  );
}
