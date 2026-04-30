import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChangeCard } from "@/components/dashboard/change-card";
import { PollButton } from "@/components/dashboard/poll-button";
import { UrlConfigForm } from "@/components/dashboard/url-config-form";
import { formatDistanceToNow } from "@/lib/time";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { TopicCardData } from "@/components/dashboard/topic-card-tile";
import type { Prisma } from "@/generated/prisma/client";

const FETCH_TONE: Record<string, string> = {
  STATIC: "pill-green",
  PLAYWRIGHT: "pill-blue",
  STEALTH: "pill-indigo",
  CAMOUFOX: "pill-indigo",
  EXTERNAL: "pill-orange",
};

const CATEGORY_PALETTE: Record<string, { bg: string; ink: string }> = {
  POLICY: { bg: "rgba(99,102,241,0.10)", ink: "#4338CA" },
  FEES: { bg: "rgba(34,197,94,0.10)", ink: "#15803D" },
  APPOINTMENTS: { bg: "rgba(234,88,12,0.10)", ink: "#C2410C" },
  DOCUMENTS: { bg: "rgba(14,165,233,0.10)", ink: "#0369A1" },
  NEWS: { bg: "rgba(168,85,247,0.10)", ink: "#7E22CE" },
  OTHER: { bg: "rgba(115,115,115,0.10)", ink: "#525252" },
  SKIP: { bg: "rgba(115,115,115,0.06)", ink: "#737373" },
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
  const card = (url.topicCard as Prisma.JsonValue as TopicCardData | null) ?? null;
  const palette = card ? CATEGORY_PALETTE[card.category] ?? CATEGORY_PALETTE.OTHER : null;

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
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
        {card && palette && (
          <span
            className="pill inline-flex mb-3"
            style={{
              background: palette.bg,
              color: palette.ink,
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {card.category}
          </span>
        )}
        {!card && <span className="eyebrow inline-block mb-3">Monitored URL</span>}
        <div className="flex items-center gap-3 flex-wrap mb-2">
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
            {card?.title ?? url.url}
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
        {card && (
          <p
            className="mb-3"
            style={{ fontSize: 14, color: "var(--foreground-2)", lineHeight: 1.6 }}
          >
            {card.summary}
          </p>
        )}
        <a
          href={url.url}
          target="_blank"
          rel="noopener noreferrer"
          className="accent-link inline-flex items-center gap-1.5 mb-3"
          style={{ fontSize: 12 }}
        >
          <span className="mono break-all">{url.url}</span>
        </a>
        {card && card.lastChangeNote && (
          <div
            className="mb-3 surface-flat"
            style={{
              padding: "12px 16px",
              background: "color-mix(in srgb, var(--orange) 8%, var(--background-1))",
              border: "1px solid color-mix(in srgb, var(--orange) 30%, var(--border))",
            }}
          >
            <div
              className="text-footnote-em mb-1"
              style={{ color: "var(--orange-ink)" }}
            >
              Latest change
            </div>
            <p
              style={{ fontSize: 13.5, color: "var(--foreground)", lineHeight: 1.5 }}
            >
              {card.lastChangeNote}
            </p>
            {card.lastChangeAt && (
              <p
                className="mono mt-1"
                style={{ fontSize: 11, color: "var(--foreground-4)" }}
              >
                {formatDistanceToNow(new Date(card.lastChangeAt))}
              </p>
            )}
          </div>
        )}
        {card && card.importantFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.importantFields.map((f) => (
              <span
                key={f}
                className="pill pill-muted"
                style={{ fontSize: 11 }}
              >
                {f}
              </span>
            ))}
          </div>
        )}

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
        ].map(({ label, value }, i) => (
          <div
            key={label}
            className={`card-item animate-fade-up stagger-${i + 1}`}
          >
            <div className="stat-block-label">{label}</div>
            <div
              className="tabular mt-2"
              style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.025em", lineHeight: 1.1 }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-URL config */}
      <section className="surface mb-10" style={{ padding: 24 }}>
        <h2 className="text-headline mb-1" style={{ color: "var(--foreground)" }}>
          Configuration
        </h2>
        <p className="text-footnote mb-5" style={{ color: "var(--foreground-3)" }}>
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
          <h2 className="text-headline" style={{ color: "var(--foreground)" }}>
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
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {changesWithSite.map((c) => (
              <ChangeCard key={c.id} change={c} showSite={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
