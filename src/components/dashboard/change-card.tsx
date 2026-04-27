import Link from "next/link";
import { formatDistanceToNow } from "@/lib/time";
import { SeverityBadge, SeverityDot } from "./severity-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangeCategory } from "@/generated/prisma/enums";

interface ChangeCardProps {
  change: {
    id: string;
    summary: string;
    detail?: string | null;
    severity: number;
    category: ChangeCategory;
    confidence: number;
    detectedAt: Date;
    emailSent: boolean;
    site: { id: string; name: string; url: string };
  };
  showSite?: boolean;
}

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  POLICY_CHANGE: "Policy",
  FEE_CHANGE: "Fee",
  APPOINTMENT: "Appointment",
  DOCUMENT_REQUIREMENT: "Documents",
  NAVIGATION: "Navigation",
  COSMETIC: "Cosmetic",
  UNKNOWN: "Unknown",
};

export function ChangeCard({ change, showSite = true }: ChangeCardProps) {
  const isHighSeverity = change.severity >= 4;
  const isAlertSent = change.emailSent;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all border bg-card hover:shadow-md",
        isHighSeverity && "border-l-4 border-l-red-500"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <SeverityDot severity={change.severity} />
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <SeverityBadge severity={change.severity} />
              <Badge variant="outline" className="text-[11px] bg-muted/50 border-border/50">
                {CATEGORY_LABELS[change.category]}
              </Badge>
              {isAlertSent && (
                <Badge variant="outline" className="text-[11px] bg-blue-950/50 text-blue-400 border-blue-800">
                  Alerted
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto">
                {formatDistanceToNow(change.detectedAt)}
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm font-medium text-foreground leading-snug">
              {change.summary}
            </p>

            {/* Detail */}
            {change.detail && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{change.detail}</p>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 mt-2.5">
              {showSite && (
                <Link
                  href={`/sites/${change.site.id}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-medium">{change.site.name}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <Link
                href={`/changes/${change.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors opacity-0 group-hover:opacity-100"
              >
                View diff <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
