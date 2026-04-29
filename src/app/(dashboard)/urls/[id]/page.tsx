import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChangeCard } from "@/components/dashboard/change-card";
import { PollButton } from "@/components/dashboard/poll-button";
import { UrlConfigForm } from "@/components/dashboard/url-config-form";
import { formatDistanceToNow } from "@/lib/time";
import {
  ArrowLeft,
  ExternalLink,
  Activity,
  AlertTriangle,
  Clock,
  BarChart2,
} from "lucide-react";

const FETCH_MODE_BADGE: Record<string, string> = {
  STATIC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PLAYWRIGHT: "bg-blue-50 text-blue-700 border-blue-200",
  STEALTH: "bg-violet-50 text-violet-700 border-violet-200",
  EXTERNAL: "bg-amber-50 text-amber-700 border-amber-200",
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
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/sites/${url.site.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {url.site.name}
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h1 className="text-lg font-semibold break-all">{url.url}</h1>
          <a
            href={url.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${FETCH_MODE_BADGE[url.fetchMode] ?? ""}`}>
            {url.fetchMode}
          </Badge>
          {url.paused && (
            <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
              Paused
            </Badge>
          )}
          {url.consecutiveFailures > 0 && (
            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
              {url.consecutiveFailures}× {url.lastFailureKind ?? "fail"}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            <PollButton monitoredUrlId={url.id} label="Poll now" />
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Changes", value: url._count.changes, icon: BarChart2 },
          { label: "Snapshots", value: url._count.snapshots, icon: Activity },
          {
            label: "Last check",
            value: url.lastCheckedAt ? formatDistanceToNow(url.lastCheckedAt) : "never",
            icon: Clock,
          },
          {
            label: "Last failure",
            value: url.lastFailureAt ? formatDistanceToNow(url.lastFailureAt) : "—",
            icon: AlertTriangle,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </CardTitle>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-base font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="mb-8" />

      {/* Per-URL config */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Per-URL configuration</h2>
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
      </div>

      <Separator className="mb-8" />

      {/* Changes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Changes for this URL</h2>
          <span className="text-xs text-muted-foreground">{url._count.changes} total</span>
        </div>
        {url.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            No changes detected yet.
          </p>
        ) : (
          <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border, #E8E8F2)" }}>
            {changesWithSite.map((c) => (
              <ChangeCard key={c.id} change={c} showSite={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
