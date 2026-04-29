import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  POLICY_CHANGE: "Policy Change",
  FEE_CHANGE: "Fee Change",
  APPOINTMENT: "Appointment",
  DOCUMENT_REQUIREMENT: "Document Requirement",
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
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/sites/${change.siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {change.site.name}
      </Link>

      {isHighSeverity && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This is a high-severity change that may affect visa applications.
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SeverityBadge severity={change.severity} />
          <Badge variant="outline" className="text-[11px] border-border/50 bg-muted/30">
            {CATEGORY_LABELS[change.category]}
          </Badge>
          {change.classifierStatus === "VALIDATED" && (
            <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Grounded
            </Badge>
          )}
          {change.classifierStatus === "CLAMPED" && (
            <Badge
              variant="outline"
              className="text-[11px] bg-violet-50 text-violet-700 border-violet-200"
              title={`LLM said sev ${change.classifierRawSeverity ?? "?"} → clamped to ${change.severity}`}
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              Rule-clamped
            </Badge>
          )}
          {change.classifierStatus === "UNGROUNDED" && (
            <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
              <ShieldAlert className="h-3 w-3 mr-1" />
              Ungrounded
            </Badge>
          )}
          {change.classifierStatus === "FALLBACK" && (
            <Badge variant="outline" className="text-[11px] bg-muted/50 text-muted-foreground">
              Fallback (LLM unavailable)
            </Badge>
          )}
          {change.muted && (
            <Badge variant="outline" className="text-[11px] bg-muted/50 text-muted-foreground">
              <BellOff className="h-3 w-3 mr-1" />
              Muted
            </Badge>
          )}
          {change.emailStatus === "SENT" && (
            <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
              <Mail className="h-3 w-3 mr-1" />
              Alert sent
            </Badge>
          )}
          {change.emailStatus === "FAILED" && (
            <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
              <Mail className="h-3 w-3 mr-1" />
              Alert failed (retrying)
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDate(change.detectedAt)}
          </span>
        </div>

        <h1 className="text-xl font-semibold leading-snug mb-2">{change.summary}</h1>
        {change.detail && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{change.detail}</p>
        )}

        <div className="flex gap-2">
          <AcknowledgeButton changeId={change.id} acknowledged={!!change.acknowledgedAt} />
        </div>
      </div>

      {/* Phase 3: Evidence quotes */}
      {change.evidenceQuotes.length > 0 && (
        <Card className="bg-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Quote className="h-4 w-4 text-violet-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Evidence from source ({change.evidenceQuotes.length})
              </h2>
            </div>
            <ul className="space-y-2">
              {change.evidenceQuotes.map((q, i) => (
                <li
                  key={i}
                  className="border-l-2 border-violet-200 pl-3 py-0.5 text-sm leading-relaxed text-foreground/90"
                >
                  {q}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Phase 3: Classifier metadata */}
      {(change.classifierModel || change.classifierTokensIn) && (
        <details className="group mb-6">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-2 select-none">
            <span>Classifier metadata</span>
            <span className="group-open:hidden">↓</span>
            <span className="hidden group-open:inline">↑</span>
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            {[
              ["model", change.classifierModel ?? "—"],
              ["prompt", change.classifierPromptVersion],
              ["status", change.classifierStatus],
              ["tokens in/out", `${change.classifierTokensIn ?? 0}/${change.classifierTokensOut ?? 0}`],
              ["cost", change.classifierCostUsd != null ? `$${change.classifierCostUsd.toFixed(5)}` : "—"],
              ["raw severity", change.classifierRawSeverity ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="border rounded px-2 py-1 bg-muted/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div>{String(v)}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Site info card */}
      <Card className="bg-card border-border/50 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Monitored URL</p>
              <Link
                href={`/urls/${change.monitoredUrlId}`}
                className="text-sm font-medium hover:text-violet-700 transition-colors break-all"
              >
                {change.monitoredUrl.url}
              </Link>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{confidencePct}%</span>
              </div>
            </div>
            <a
              href={change.monitoredUrl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Visit URL
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Diff */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Content Diff
          <span className="text-xs font-normal text-muted-foreground">
            Green = added · Red = removed
          </span>
        </h2>
        <DiffViewer diffText={change.diffText} maxHeight={600} />
      </div>
    </div>
  );
}
