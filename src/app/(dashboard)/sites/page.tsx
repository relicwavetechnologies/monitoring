import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Globe } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TopicCardTile, type TopicCardData } from "@/components/dashboard/topic-card-tile";
import { PollButton } from "@/components/dashboard/poll-button";
import type { Prisma } from "@/generated/prisma/client";

export default async function SitesPage() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      monitoredUrls: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          url: true,
          paused: true,
          topicCard: true,
          consecutiveFailures: true,
          lastFailureKind: true,
          lastCheckedAt: true,
        },
      },
      _count: { select: { changes: true, monitoredUrls: true } },
    },
  });

  const totalUrls = sites.reduce((acc, s) => acc + s._count.monitoredUrls, 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div>
          <h1 className="hero-title">Sites</h1>
          <p className="hero-sub mt-1">
            {sites.length} site{sites.length !== 1 ? "s" : ""} · {totalUrls} pages monitored
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
          description="Add your first visa site. AI will crawl it and pick the visa-relevant pages for you."
          action={
            <Link
              href="/sites/new"
              className="btn-pill"
              style={{ fontSize: 13, padding: "8px 16px" }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              Add site
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {sites.map((site) => (
            <section key={site.id}>
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
                  <Link
                    href={`/sites/${site.id}`}
                    className="text-headline subtle-link"
                    style={{ color: "var(--foreground)" }}
                  >
                    {site.name}
                  </Link>
                  <span
                    className="mono text-footnote truncate"
                    style={{ color: "var(--foreground-4)" }}
                  >
                    {(() => {
                      try {
                        return new URL(site.url).hostname;
                      } catch {
                        return site.url;
                      }
                    })()}
                  </span>
                  {site.isActive ? (
                    <span className="pill pill-green" style={{ fontSize: 10.5 }}>
                      <span className="status-dot status-dot-green" />
                      Active
                    </span>
                  ) : (
                    <span className="pill pill-muted" style={{ fontSize: 10.5 }}>
                      Paused
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="pill pill-muted tabular"
                    style={{ fontSize: 11 }}
                    title="changes detected"
                  >
                    {site._count.changes} changes
                  </span>
                  <PollButton siteId={site.id} />
                </div>
              </div>

              {site.monitoredUrls.length === 0 ? (
                <div
                  className="surface-flat text-center text-footnote"
                  style={{ padding: 18, color: "var(--foreground-3)" }}
                >
                  No pages monitored — re-run the wizard to pick pages.
                </div>
              ) : (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
                >
                  {site.monitoredUrls.map((u) => (
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
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
