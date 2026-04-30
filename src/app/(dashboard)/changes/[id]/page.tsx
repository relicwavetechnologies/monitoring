import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { AcknowledgeButton } from "@/components/dashboard/acknowledge-button";
import { formatDate } from "@/lib/time";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  BellOff,
  Quote,
} from "lucide-react";
import { ChangeCategory } from "@/generated/prisma/enums";

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  POLICY_CHANGE: "Policy",
  FEE_CHANGE: "Fee",
  APPOINTMENT: "Appointment",
  DOCUMENT_REQUIREMENT: "Documents",
  NAVIGATION: "Navigation",
  COSMETIC: "Cosmetic",
  UNKNOWN: "Unknown",
};

export default async function ChangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const change = await db.change.findUnique({
    where: { id },
    include: { site: true, monitoredUrl: true },
  });

  if (!change) notFound();

  const confidencePct = Math.round(change.confidence * 100);
  const isHighSeverity = change.severity >= 4;

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-up">
      <Link
        href={`/sites/${change.siteId}`}
        className="subtle-link inline-flex items-center gap-1.5 mb-6"
        style={{ fontSize: 13, letterSpacing: "-0.011em" }}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        {change.site.name}
      </Link>

      {isHighSeverity && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5"
          style={{
            background: "var(--red-soft)",
            border: "1px solid color-mix(in srgb, var(--red) 22%, transparent)",
            color: "var(--red-ink)",
            fontSize: 13.5,
            letterSpacing: "-0.011em",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>This is a high-severity change that may affect visa applications.</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3.5">
          <SeverityBadge severity={change.severity} />
          <span
            className={`pill pill-${
              change.severity >= 4 ? "red" : change.severity >= 3 ? "orange" : "muted"
            }`}
          >
            {CATEGORY_LABELS[change.category]}
          </span>

          {change.classifierStatus === "VALIDATED" && (
            <span className="pill pill-green">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} />
              Grounded
            </span>
          )}
          {change.classifierStatus === "CLAMPED" && (
            <span
              className="pill pill-indigo"
              title={`LLM said sev ${change.classifierRawSeverity ?? "?"} → clamped to ${change.severity}`}
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={2} />
              Rule-clamped
            </span>
          )}
          {change.classifierStatus === "UNGROUNDED" && (
            <span className="pill pill-orange">
              <ShieldAlert className="h-3 w-3" strokeWidth={2} />
              Ungrounded
            </span>
          )}
          {change.classifierStatus === "FALLBACK" && (
            <span className="pill pill-muted">Fallback (LLM unavailable)</span>
          )}
          {change.muted && (
            <span className="pill pill-muted">
              <BellOff className="h-3 w-3" strokeWidth={2} />
              Muted
            </span>
          )}
          {change.emailStatus === "SENT" && (
            <span className="pill pill-blue">
              <Mail className="h-3 w-3" strokeWidth={2} />
              Alert sent
            </span>
          )}
          {change.emailStatus === "FAILED" && (
            <span className="pill pill-red">
              <Mail className="h-3 w-3" strokeWidth={2} />
              Alert failed
            </span>
          )}

          <span className="ml-auto label-mono shrink-0">{formatDate(change.detectedAt)}</span>
        </div>

        <h1
          className="text-title-1 mb-2"
          style={{ color: "var(--foreground)" }}
        >
          {change.summary}
        </h1>
        {change.detail && (
          <p
            className="text-body mb-4"
            style={{ color: "var(--foreground-2)" }}
          >
            {change.detail}
          </p>
        )}

        <div className="flex gap-2">
          <AcknowledgeButton changeId={change.id} acknowledged={!!change.acknowledgedAt} />
        </div>
      </div>

      {/* Evidence quotes */}
      {change.evidenceQuotes.length > 0 && (
        <section
          className="surface mb-5 animate-fade-up"
          style={{ padding: 22 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Quote className="h-4 w-4" strokeWidth={2} style={{ color: "var(--primary)" }} />
            <h2
              className="eyebrow"
              style={{ margin: 0 }}
            >
              Evidence from source · {change.evidenceQuotes.length}
            </h2>
          </div>
          <ul className="space-y-2.5">
            {change.evidenceQuotes.map((q, i) => (
              <li
                key={i}
                className="text-subhead"
                style={{
                  borderLeft: "2px solid var(--accent-line)",
                  paddingLeft: 14,
                  paddingTop: 2,
                  paddingBottom: 2,
                  color: "var(--foreground)",
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* URL + confidence */}
      <section className="surface mb-5" style={{ padding: 20 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1.5">Monitored URL</div>
            <Link
              href={`/urls/${change.monitoredUrlId}`}
              className="text-subhead-em block truncate accent-link"
              style={{ color: "var(--foreground)" }}
            >
              {change.monitoredUrl.url}
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="eyebrow mb-1.5">Confidence</div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    height: 5,
                    width: 96,
                    borderRadius: 999,
                    background: "var(--background-3)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background:
                        confidencePct >= 70
                          ? "var(--green)"
                          : confidencePct >= 40
                          ? "var(--orange)"
                          : "var(--red)",
                      width: `${confidencePct}%`,
                      borderRadius: 999,
                      transition: "width var(--d-slow) var(--ease-out)",
                    }}
                  />
                </div>
                <span
                  className="tabular text-footnote-em"
                  style={{ color: "var(--foreground)" }}
                >
                  {confidencePct}%
                </span>
              </div>
            </div>

            <a
              href={change.monitoredUrl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-link inline-flex items-center gap-1 text-footnote"
            >
              Visit URL
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.85} />
            </a>
          </div>
        </div>
      </section>

      {/* Classifier metadata */}
      {(change.classifierModel || change.classifierTokensIn) && (
        <details className="group mb-5 surface" style={{ padding: 18 }}>
          <summary className="eyebrow cursor-pointer inline-flex items-center gap-2 select-none">
            <span>Classifier metadata</span>
            <span className="group-open:rotate-90 transition-transform">›</span>
          </summary>
          <div
            className="mt-4 grid gap-2 mono"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              fontSize: 12.5,
            }}
          >
            {[
              ["model", change.classifierModel ?? "—"],
              ["prompt", change.classifierPromptVersion],
              ["status", change.classifierStatus],
              [
                "tokens",
                `${change.classifierTokensIn ?? 0}/${change.classifierTokensOut ?? 0}`,
              ],
              [
                "cost",
                change.classifierCostUsd != null
                  ? `$${change.classifierCostUsd.toFixed(5)}`
                  : "—",
              ],
              ["raw severity", change.classifierRawSeverity ?? "—"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "9px 11px",
                  background: "var(--background-2)",
                }}
              >
                <div className="text-caption-2" style={{ color: "var(--foreground-3)", marginBottom: 3 }}>
                  {String(k).toUpperCase()}
                </div>
                <div style={{ color: "var(--foreground)" }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Diff */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-headline" style={{ color: "var(--foreground)" }}>
            Content diff
          </h2>
          <span className="label-mono inline-flex items-center">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
              style={{ background: "var(--green)" }}
            />
            added
            <span
              className="inline-block w-1.5 h-1.5 rounded-full ml-3 mr-1.5"
              style={{ background: "var(--red)" }}
            />
            removed
          </span>
        </div>
        <DiffViewer diffText={change.diffText} maxHeight={600} />
      </div>
    </div>
  );
}
