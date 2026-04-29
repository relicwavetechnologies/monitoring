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
          style={{
            fontSize: 26,
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            fontWeight: 700,
            color: "var(--foreground)",
            marginBottom: 8,
          }}
        >
          {change.summary}
        </h1>
        {change.detail && (
          <p
            className="mb-4"
            style={{
              fontSize: 15.5,
              color: "var(--foreground-2)",
              lineHeight: 1.55,
              letterSpacing: "-0.011em",
            }}
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
          className="surface mb-5"
          style={{ padding: 20 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Quote className="h-4 w-4" strokeWidth={2} style={{ color: "var(--primary)" }} />
            <h2
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--foreground-3)",
              }}
            >
              Evidence from source · {change.evidenceQuotes.length}
            </h2>
          </div>
          <ul className="space-y-2.5">
            {change.evidenceQuotes.map((q, i) => (
              <li
                key={i}
                style={{
                  borderLeft: "2px solid var(--accent-line)",
                  paddingLeft: 14,
                  paddingTop: 2,
                  paddingBottom: 2,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--foreground)",
                  letterSpacing: "-0.011em",
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* URL + confidence */}
      <section className="surface mb-5" style={{ padding: 18 }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="label-mono mb-1.5">Monitored URL</div>
            <Link
              href={`/urls/${change.monitoredUrlId}`}
              className="block truncate"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--foreground)",
                letterSpacing: "-0.011em",
              }}
            >
              {change.monitoredUrl.url}
            </Link>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="label-mono mb-1.5">Confidence</div>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    height: 4,
                    width: 84,
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
                    }}
                  />
                </div>
                <span
                  className="tabular"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    letterSpacing: "-0.011em",
                  }}
                >
                  {confidencePct}%
                </span>
              </div>
            </div>

            <a
              href={change.monitoredUrl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors"
              style={{
                fontSize: 13,
                color: "var(--foreground-3)",
                letterSpacing: "-0.011em",
              }}
            >
              Visit URL
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.85} />
            </a>
          </div>
        </div>
      </section>

      {/* Classifier metadata */}
      {(change.classifierModel || change.classifierTokensIn) && (
        <details className="group mb-5 surface" style={{ padding: 16 }}>
          <summary
            className="cursor-pointer inline-flex items-center gap-2 select-none transition-colors"
            style={{
              fontSize: 12,
              color: "var(--foreground-3)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span>Classifier metadata</span>
            <span className="group-open:rotate-90 transition-transform">›</span>
          </summary>
          <div
            className="mt-3 grid gap-2 mono"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              fontSize: 12,
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
                  padding: "8px 10px",
                  background: "var(--background-2)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--foreground-3)",
                    marginBottom: 2,
                  }}
                >
                  {k}
                </div>
                <div style={{ color: "var(--foreground)" }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Diff */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
              letterSpacing: "-0.014em",
            }}
          >
            Content diff
          </h2>
          <span className="label-mono">
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
