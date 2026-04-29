import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SeverityDot } from "@/components/dashboard/severity-badge";
import { formatDistanceToNow } from "@/lib/time";
import { Plus, Globe, ExternalLink, ChevronRight } from "lucide-react";
import { PollButton } from "@/components/dashboard/poll-button";

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

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-end justify-between mb-8 animate-fade-up">
        <div>
          <span className="eyebrow inline-block mb-3">Catalogue</span>
          <h1 className="hero-title">Sites</h1>
          <p className="hero-sub mt-2">
            {sites.length} site{sites.length !== 1 ? "s" : ""} monitored ·
            {" "}
            {sites.reduce((acc, s) => acc + s._count.monitoredUrls, 0)} URLs
          </p>
        </div>
        <Link href="/sites/new">
          <Button
            className="gap-1.5 rounded-full px-4 h-9"
            style={{
              background: "var(--primary)",
              color: "white",
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: "-0.011em",
              boxShadow: "0 1px 2px rgba(0,113,227,0.30)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Add site
          </Button>
        </Link>
      </div>

      {sites.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center surface-flat"
          style={{ borderStyle: "dashed" }}
        >
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--background-2)" }}
          >
            <Globe className="h-6 w-6" strokeWidth={1.6} style={{ color: "var(--foreground-4)" }} />
          </div>
          <p
            className="text-base font-semibold"
            style={{ color: "var(--foreground)", letterSpacing: "-0.014em" }}
          >
            No sites yet
          </p>
          <p
            className="mt-1.5 mb-5"
            style={{ color: "var(--foreground-3)", fontSize: 14 }}
          >
            Add your first visa site to start monitoring.
          </p>
          <Link href="/sites/new">
            <Button
              className="rounded-full px-4 h-9 gap-1.5"
              style={{
                background: "var(--primary)",
                color: "white",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              <Plus className="h-4 w-4" />
              Add site
            </Button>
          </Link>
        </div>
      ) : (
        <div className="surface-flat overflow-hidden">
          {sites.map((site, idx) => {
            const lastChange = site.changes[0];
            return (
              <div
                key={site.id}
                className="row-hover group flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom:
                    idx === sites.length - 1 ? "none" : "1px solid var(--border)",
                }}
              >
                {/* Site identity (link target) */}
                <Link href={`/sites/${site.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="truncate"
                      style={{
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: "var(--foreground)",
                        letterSpacing: "-0.014em",
                      }}
                    >
                      {site.name}
                    </span>
                    {site.isActive ? (
                      <span className="pill pill-green" style={{ fontSize: 10.5 }}>
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ background: "var(--green)" }}
                        />
                        Active
                      </span>
                    ) : (
                      <span className="pill pill-muted" style={{ fontSize: 10.5 }}>
                        Paused
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center gap-1.5 mt-0.5 truncate"
                    style={{
                      fontSize: 12.5,
                      color: "var(--foreground-3)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    <span className="mono">{new URL(site.url).hostname}</span>
                    <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                    <span className="opacity-50 mx-1">·</span>
                    <span>
                      {site._count.monitoredUrls} URL
                      {site._count.monitoredUrls !== 1 ? "s" : ""}
                    </span>
                  </div>
                </Link>

                {/* Last change */}
                <Link
                  href={`/sites/${site.id}`}
                  className="hidden md:flex items-center gap-2 max-w-[260px] min-w-0"
                  style={{ fontSize: 12.5, color: "var(--foreground-3)" }}
                >
                  {lastChange ? (
                    <>
                      <SeverityDot severity={lastChange.severity} />
                      <span className="line-clamp-1">{lastChange.summary}</span>
                    </>
                  ) : (
                    <span style={{ color: "var(--foreground-4)" }}>No changes yet</span>
                  )}
                </Link>

                <Link
                  href={`/sites/${site.id}`}
                  className="hidden lg:block label-mono shrink-0"
                  style={{ minWidth: 80, textAlign: "right" }}
                >
                  {site.lastCheckedAt
                    ? formatDistanceToNow(site.lastCheckedAt)
                    : "—"}
                </Link>

                <Link
                  href={`/sites/${site.id}`}
                  className="tabular shrink-0"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    minWidth: 32,
                    textAlign: "right",
                    letterSpacing: "-0.011em",
                  }}
                >
                  {site._count.changes}
                </Link>

                <PollButton siteId={site.id} />

                <Link
                  href={`/sites/${site.id}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Open ${site.name}`}
                >
                  <ChevronRight
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--foreground-3)" }}
                  />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
