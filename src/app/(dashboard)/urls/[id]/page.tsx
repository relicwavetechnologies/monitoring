import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChangeCard } from "@/components/dashboard/change-card";
import { PollButton } from "@/components/dashboard/poll-button";
import { UrlConfigForm } from "@/components/dashboard/url-config-form";
import { formatDistanceToNow } from "@/lib/time";
import { ArrowLeft, ExternalLink } from "lucide-react";

const FETCH_TONE: Record<string, string> = {
  STATIC: "pill-green",
  PLAYWRIGHT: "pill-blue",
  STEALTH: "pill-indigo",
  EXTERNAL: "pill-orange",
};

export default async function MonitoredUrlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const url = await db.monitoredUrl.findUnique({
    where: { id },
    include: {
      site: true,
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 30,
        select: {
          id: true,
          summary: true,
          detail: true,
          severity: true,
          category: true,
          confidence: true,
          detectedAt: true,
          emailStatus: true,
          siteId: true,
        },
      },
      _count: { select: { snapshots: true, changes: true } },
    },
  });

  if (!url) notFound();

  const siteForCard = { id: url.site.id, name: url.site.name, url: url.site.url };
  const changesWithSite = url.changes.map((c) => ({ ...c, site: siteForCard }));

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-up">
      <Link
        href={`/sites/${url.site.id}`}
        className="subtle-link inline-flex items-center gap-1.5 mb-6"
        style={{ fontSize: 13, letterSpacing: "-0.011em" }}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        {url.site.name}
      </Link>

      {/* Hero */}
      <div className="mb-6">
        <span className="eyebrow inline-block mb-3">Monitored URL</span>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h1
            className="break-all"
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.022em",
              lineHeight: 1.18,
              color: "var(--foreground)",
            }}
          >
            {url.url}
          </h1>
          <a
            href={url.url}
            target="_blank"
            rel="noopener noreferrer"
            className="accent-link"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.85} />
          </a>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`pill ${FETCH_TONE[url.fetchMode] ?? "pill-muted"}`}>
            {url.fetchMode}
          </span>
          {url.paused && <span className="pill pill-muted">Paused</span>}
          {url.consecutiveFailures > 0 && (
            <span className="pill pill-red tabular">
              {url.consecutiveFailures}× {url.lastFailureKind?.toLowerCase() ?? "fail"}
            </span>
          )}
          <div className="ml-auto">
            <PollButton monitoredUrlId={url.id} label="Poll now" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Changes", value: url._count.changes.toLocaleString() },
          { label: "Snapshots", value: url._count.snapshots.toLocaleString() },
          {
            label: "Last check",
            value: url.lastCheckedAt ? formatDistanceToNow(url.lastCheckedAt) : "never",
          },
          {
            label: "Last failure",
            value: url.lastFailureAt ? formatDistanceToNow(url.lastFailureAt) : "—",
          },
        ].map(({ label, value }) => (
          <div key={label} className="surface-flat p-4">
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--foreground-3)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            <div
              className="tabular mt-1.5"
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--foreground)",
                letterSpacing: "-0.018em",
                lineHeight: 1.2,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-URL config */}
      <section className="surface mb-10" style={{ padding: 22 }}>
        <h2
          className="mb-1"
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.018em",
            color: "var(--foreground)",
          }}
        >
          Configuration
        </h2>
        <p
          className="mb-5"
          style={{
            fontSize: 13,
            color: "var(--foreground-3)",
            letterSpacing: "-0.005em",
          }}
        >
          Per-URL settings — selectors, fetch tier, escalation, mute patterns.
        </p>
        <UrlConfigForm
          url={{
            id: url.id,
            url: url.url,
            contentSelector: url.contentSelector,
            stripPatterns: url.stripPatterns,
            fetchMode: url.fetchMode,
            autoEscalate: url.autoEscalate,
            escalateAfterFailures: url.escalateAfterFailures,
            mutePatterns: url.mutePatterns,
          }}
        />
      </section>

      {/* Changes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.018em",
              color: "var(--foreground)",
            }}
          >
            Changes for this URL
          </h2>
          <span className="pill pill-muted tabular">{url._count.changes}</span>
        </div>
        {url.changes.length === 0 ? (
          <div
            className="surface-flat py-12 text-center"
            style={{ borderStyle: "dashed", color: "var(--foreground-3)" }}
          >
            <p style={{ fontSize: 14, letterSpacing: "-0.011em" }}>No changes detected yet.</p>
          </div>
        ) : (
          <div className="surface-flat overflow-hidden">
            {changesWithSite.map((c) => (
              <ChangeCard key={c.id} change={c} showSite={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
