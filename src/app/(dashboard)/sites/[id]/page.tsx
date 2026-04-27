import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChangeCard } from "@/components/dashboard/change-card";
import { SiteActionButtons } from "@/components/dashboard/site-action-buttons";
import { formatDistanceToNow, formatDate } from "@/lib/time";
import {
  ArrowLeft,
  Globe,
  Clock,
  BarChart2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Settings2,
} from "lucide-react";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const site = await db.site.findUnique({
    where: { id },
    include: {
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 50,
        select: {
          id: true,
          summary: true,
          detail: true,
          severity: true,
          category: true,
          confidence: true,
          detectedAt: true,
          emailSent: true,
          siteId: true,
        },
      },
      _count: { select: { snapshots: true, changes: true } },
    },
  });

  if (!site) notFound();

  const recentChanges = site.changes;
  const siteForCard = { id: site.id, name: site.name, url: site.url };
  const changesWithSite = recentChanges.map((c) => ({ ...c, site: siteForCard }));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/sites"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All Sites
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-semibold">{site.name}</h1>
            {site.isActive ? (
              <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[11px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                <XCircle className="h-3 w-3 mr-1" />
                Paused
              </Badge>
            )}
          </div>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            {site.url}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <SiteActionButtons siteId={site.id} isActive={site.isActive} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Changes",
            value: site._count.changes,
            icon: BarChart2,
          },
          {
            label: "Snapshots",
            value: site._count.snapshots,
            icon: Globe,
          },
          {
            label: "Poll Every",
            value: `${site.pollIntervalMin}m`,
            icon: Clock,
          },
          {
            label: "Last Check",
            value: site.lastCheckedAt ? formatDistanceToNow(site.lastCheckedAt) : "Never",
            icon: CheckCircle2,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Adapter config */}
      <details className="group mb-8">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none">
          <Settings2 className="h-4 w-4" />
          <span>Adapter Configuration</span>
          <span className="ml-auto text-xs group-open:hidden">Show</span>
          <span className="ml-auto text-xs hidden group-open:inline">Hide</span>
        </summary>
        <Card className="mt-3 bg-card border-border/50">
          <CardContent className="p-4 space-y-3">
            {[
              { label: "Render Mode", value: site.renderMode },
              { label: "Content Selector", value: site.contentSelector || "body" },
              { label: "Poll Interval", value: `${site.pollIntervalMin} minutes` },
              {
                label: "Strip Patterns",
                value:
                  site.stripPatterns.length > 0
                    ? site.stripPatterns.join(", ")
                    : "None",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
                <code className="text-xs font-mono text-foreground break-all">{value}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </details>

      <Separator className="mb-8" />

      {/* Change timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Change History</h2>
          <span className="text-xs text-muted-foreground">{site._count.changes} changes total</span>
        </div>

        {recentChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-xl">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No changes detected yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Poll this site to take a baseline snapshot.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {changesWithSite.map((c) => (
              <ChangeCard key={c.id} change={c} showSite={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
