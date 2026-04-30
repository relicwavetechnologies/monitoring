import { gunzipSync } from "zlib";
import { marked } from "marked";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChangeCard } from "@/components/dashboard/change-card";
import { SiteActionButtons } from "@/components/dashboard/site-action-buttons";
import { AnalyzeButton } from "@/components/dashboard/analyze-button";
import { MonitoredUrlRow } from "@/components/dashboard/monitored-url-row";
import { AddUrlForm } from "@/components/dashboard/add-url-form";
import { formatDistanceToNow } from "@/lib/time";
import {
  ArrowLeft,
  Globe,
  Clock,
  BarChart2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Settings2,
  FileText,
  Sparkles,
} from "lucide-react";

// Configure marked for clean output
marked.setOptions({ gfm: true, breaks: false });

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
          emailStatus: true,
          siteId: true,
        },
      },
      monitoredUrls: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          url: true,
          paused: true,
          fetchMode: true,
          consecutiveFailures: true,
          lastFailureKind: true,
          lastCheckedAt: true,
        },
      },
      _count: { select: { snapshots: true, changes: true } },
    },
  });

  if (!site) notFound();

  // Latest snapshot extracted text
  const latestSnapshot = await db.snapshot.findFirst({
    where: { siteId: id },
    orderBy: { fetchedAt: "desc" },
    select: { textGz: true, fetchedAt: true },
  });

  let extractedText: string | null = null;
  if (latestSnapshot?.textGz) {
    try {
      extractedText = gunzipSync(Buffer.from(latestSnapshot.textGz)).toString("utf8");
    } catch {
      extractedText = null;
    }
  }

  // Render AI analysis markdown → HTML
  let analysisHtml: string | null = null;
  if (site.aiAnalysis) {
    analysisHtml = await Promise.resolve(marked.parse(site.aiAnalysis));
  }

  const recentChanges = site.changes;
  const siteForCard = { id: site.id, name: site.name, url: site.url };
  const changesWithSite = recentChanges.map((c) => ({ ...c, site: siteForCard }));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/sites"
        className="subtle-link inline-flex items-center gap-1.5 mb-6"
        style={{ fontSize: 13, letterSpacing: "-0.011em" }}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All sites
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 animate-fade-up">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h1 className="text-title-1" style={{ color: "var(--foreground)" }}>
              {site.name}
            </h1>
            {site.isActive ? (
              <span className="pill pill-green">
                <span className="status-dot status-dot-green" />
                Active
              </span>
            ) : (
              <span className="pill pill-muted">Paused</span>
            )}
          </div>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="accent-link inline-flex items-center gap-1.5 text-subhead"
          >
            <span className="mono truncate">{site.url}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.85} />
          </a>
        </div>
        <SiteActionButtons siteId={site.id} isActive={site.isActive} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Total changes", value: site._count.changes.toLocaleString() },
          { label: "Snapshots", value: site._count.snapshots.toLocaleString() },
          { label: "Poll every", value: `${site.pollIntervalMin}m` },
          {
            label: "Last check",
            value: site.lastCheckedAt ? formatDistanceToNow(site.lastCheckedAt) : "Never",
          },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            className={`surface-flat animate-fade-up stagger-${i + 1}`}
            style={{ padding: "16px 18px" }}
          >
            <div
              className="text-caption-2"
              style={{ color: "var(--foreground-3)" }}
            >
              {label.toUpperCase()}
            </div>
            <div
              className="tabular mt-2"
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.022em",
                color: "var(--foreground)",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
          </div>
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
                value: site.stripPatterns.length > 0 ? site.stripPatterns.join(", ") : "None",
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

      {/* ── Monitored URLs (Phase 2b) ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-headline" style={{ color: "var(--foreground)" }}>
              Monitored URLs
            </h2>
            <span className="pill pill-muted tabular">
              {site.monitoredUrls.length}
            </span>
          </div>
          <AddUrlForm siteId={site.id} />
        </div>

        {site.monitoredUrls.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center surface-flat"
            style={{ borderStyle: "dashed" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: "var(--background-2)" }}
            >
              <Globe className="h-5 w-5" strokeWidth={1.6} style={{ color: "var(--foreground-4)" }} />
            </div>
            <p className="text-callout-em" style={{ color: "var(--foreground)" }}>
              No URLs monitored yet
            </p>
            <p className="text-footnote mt-1" style={{ color: "var(--foreground-3)" }}>
              Add a URL to start polling.
            </p>
          </div>
        ) : (
          <div className="surface-flat overflow-hidden">
            {site.monitoredUrls.map((u) => (
              <MonitoredUrlRow key={u.id} url={u} />
            ))}
          </div>
        )}
      </div>

      <Separator className="mb-8" />

      {/* ── Captured Content ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Captured Content</h2>
          </div>
          {latestSnapshot?.fetchedAt && (
            <span className="text-xs text-muted-foreground">
              Snapshot from {formatDistanceToNow(latestSnapshot.fetchedAt)}
            </span>
          )}
        </div>

        {extractedText ? (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none px-4 py-3 rounded-lg border border-border/50 bg-muted/20">
              <span className="font-mono">
                {extractedText.length.toLocaleString()} characters extracted
              </span>
              <span className="ml-auto group-open:hidden">Expand ↓</span>
              <span className="ml-auto hidden group-open:inline">Collapse ↑</span>
            </summary>
            <div className="mt-2 rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
              <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words overflow-y-auto max-h-[400px] leading-relaxed">
                {extractedText}
              </pre>
            </div>
          </details>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/50 rounded-xl text-center">
            <FileText className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No content captured yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Poll this site to capture its first snapshot.
            </p>
          </div>
        )}
      </div>

      {/* ── AI Analysis ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold">AI Analysis</h2>
            {site.aiAnalysisAt && (
              <span className="text-xs text-muted-foreground">
                · Last run {formatDistanceToNow(site.aiAnalysisAt)}
              </span>
            )}
          </div>
          {extractedText && <AnalyzeButton siteId={site.id} />}
        </div>

        {analysisHtml ? (
          <Card className="bg-card border-border/50">
            <CardContent className="p-5">
              <div
                className="analysis-body"
                dangerouslySetInnerHTML={{ __html: analysisHtml }}
              />
            </CardContent>
          </Card>
        ) : extractedText ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/50 rounded-xl text-center">
            <Sparkles className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No analysis yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Click &ldquo;Analyze with AI&rdquo; to extract visa-relevant information.
            </p>
            <AnalyzeButton siteId={site.id} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/50 rounded-xl text-center">
            <Sparkles className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Poll the site first</p>
            <p className="text-xs text-muted-foreground mt-1">
              Analysis requires a snapshot to be captured.
            </p>
          </div>
        )}
      </div>

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
          <div style={{ border: "1px solid var(--border, #E8E8F2)", borderRadius: 6, overflow: "hidden" }}>
            {changesWithSite.map((c) => (
              <ChangeCard key={c.id} change={c} showSite={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
