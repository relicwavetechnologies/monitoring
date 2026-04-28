import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { DiffViewer } from "@/components/dashboard/diff-viewer";
import { formatDate } from "@/lib/time";
import { ArrowLeft, ExternalLink, Mail, AlertTriangle } from "lucide-react";
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
    include: { site: true },
  });

  if (!change) notFound();

  const confidencePct = Math.round(change.confidence * 100);
  const isHighSeverity = change.severity >= 4;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href={`/sites/${change.siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {change.site.name}
      </Link>

      {/* Header */}
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
          {change.emailSent && (
            <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
              <Mail className="h-3 w-3 mr-1" />
              Alert Sent
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDate(change.detectedAt)}
          </span>
        </div>

        <h1 className="text-xl font-semibold leading-snug mb-2">{change.summary}</h1>
        {change.detail && (
          <p className="text-sm text-muted-foreground leading-relaxed">{change.detail}</p>
        )}
      </div>

      {/* Site info */}
      <Card className="bg-card border-border/50 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Monitored Site</p>
              <Link
                href={`/sites/${change.siteId}`}
                className="text-sm font-medium hover:text-violet-700 transition-colors"
              >
                {change.site.name}
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
              href={change.site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Visit site
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
