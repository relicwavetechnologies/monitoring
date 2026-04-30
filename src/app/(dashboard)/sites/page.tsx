import { db } from "@/lib/db";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/time";
import { Plus, Globe, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { PollButton } from "@/components/dashboard/poll-button";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function SitesPage() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { changes: true, snapshots: true, monitoredUrls: true } },
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 1,
        select: { severity: true, summary: true, detectedAt: true, id: true },
      },
    },
  });

  const totalUrls = sites.reduce((acc, s) => acc + s._count.monitoredUrls, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <h1 className="hero-title">Sites</h1>
          <p className="hero-sub mt-1">
            {sites.length} site{sites.length !== 1 ? "s" : ""} · {totalUrls} URLs monitored
          </p>
        </div>
        <Link href="/sites/new" className="btn-pill" style={{ fontSize: 13, padding: "8px 16px" }}>
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          Add site
        </Link>
      </div>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Add your first visa site to start monitoring."
          action={
            <Link href="/sites/new" className="btn-pill" style={{ fontSize: 13, padding: "8px 16px" }}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              Add site
            </Link>
          }
        />
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {sites.map((site) => {
            const lastChange = site.changes[0];
            const hasSevereChange = lastChange && lastChange.severity >= 3;

            return (
              <div
                key={site.id}
                className="group"
                style={{
                  background: "var(--background-1)",
                  border: `1px solid ${hasSevereChange ? "color-mix(in srgb, var(--orange) 30%, var(--border))" : "var(--border)"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 120ms ease, box-shadow 120ms ease",
                }}
              >
                {/* Card body — links to site detail */}
                <Link
                  href={`/sites/${site.id}`}
                  className="flex-1 block"
                  style={{ padding: "18px 18px 14px" }}
                >
                  {/* Site name + status */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        letterSpacing: "-0.016em",
                        color: "var(--foreground)",
                        lineHeight: 1.3,
                      }}
                    >
                      {site.name}
                    </h3>
                    {site.isActive ? (
                      <span className="pill pill-green shrink-0" style={{ fontSize: 10.5 }}>
                        <span className="status-dot status-dot-green" />
                        Active
                      </span>
                    ) : (
                      <span className="pill pill-muted shrink-0" style={{ fontSize: 10.5 }}>
                        Paused
                      </span>
                    )}
                  </div>

                  {/* URL */}
                  <div
                    className="flex items-center gap-1 mb-3"
                    style={{ fontSize: 12, color: "var(--foreground-4)" }}
                  >
                    <Globe className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                    <span className="truncate mono">{new URL(site.url).hostname}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                  </div>

                  {/* Last change preview */}
                  {lastChange ? (
                    <p
                      className="line-clamp-2"
                      style={{
                        fontSize: 12.5,
                        color: hasSevereChange ? "var(--orange-ink)" : "var(--foreground-3)",
                        lineHeight: 1.5,
                      }}
                    >
                      {hasSevereChange && (
                        <AlertCircle
                          className="inline-block mr-1 -mt-0.5 h-3 w-3"
                          strokeWidth={2}
                          aria-hidden
                        />
                      )}
                      {lastChange.summary}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12.5, color: "var(--foreground-4)" }}>
                      No changes detected yet
                    </p>
                  )}
                </Link>

                {/* Card footer */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  {/* Meta */}
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ fontSize: 11.5, color: "var(--foreground-4)" }}
                    >
                      <Clock className="h-3 w-3" strokeWidth={1.8} />
                      {site.lastCheckedAt ? formatDistanceToNow(site.lastCheckedAt) : "Never"}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--foreground-4)" }}>
                      {site._count.changes} changes
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--foreground-4)" }}>
                      {site._count.monitoredUrls} URL{site._count.monitoredUrls !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Poll action */}
                  <PollButton siteId={site.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
