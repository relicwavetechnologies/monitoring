import Link from "next/link";
import { formatDistanceToNow } from "@/lib/time";
import { Clock, ExternalLink } from "lucide-react";
import { ChangeCategory, EmailStatus } from "@/generated/prisma/enums";

interface ChangeCardProps {
  change: {
    id: string;
    summary: string;
    detail?: string | null;
    severity: number;
    category: ChangeCategory;
    confidence: number;
    detectedAt: Date;
    emailStatus: EmailStatus;
    site: { id: string; name: string; url: string };
  };
  showSite?: boolean;
}

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  POLICY_CHANGE:        "Policy",
  FEE_CHANGE:           "Fee",
  APPOINTMENT:          "Appointment",
  DOCUMENT_REQUIREMENT: "Documents",
  NAVIGATION:           "Navigation",
  COSMETIC:             "Cosmetic",
  UNKNOWN:              "Unknown",
};

/** Severity → pill colour class */
const SEV_PILL: Record<number, string> = {
  1: "pill-muted",
  2: "pill-muted",
  3: "pill-orange",
  4: "pill-red",
  5: "pill-red",
};

/** Left accent stripe colour — only sev 3+ */
const SEV_STRIPE: Record<number, string> = {
  1: "transparent",
  2: "transparent",
  3: "var(--orange)",
  4: "var(--red)",
  5: "var(--red)",
};

export function ChangeCard({ change, showSite = true }: ChangeCardProps) {
  const sev = Math.max(1, Math.min(5, change.severity));

  return (
    <Link
      href={`/changes/${change.id}`}
      className="group flex card-item gap-0 p-0 overflow-hidden"
      style={{ display: "flex", marginBottom: 0 }}
    >
      {/* Accent stripe — only sev 3+ */}
      <span
        aria-hidden
        className="shrink-0 self-stretch"
        style={{ width: 3, background: SEV_STRIPE[sev], borderRadius: "14px 0 0 14px" }}
      />

      <div className="flex-1 min-w-0 px-5 py-4 row-hover" style={{ borderRadius: "0 14px 14px 0" }}>
        {/* Top row — site + meta */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {showSite && (
            <span
              className="inline-flex items-center gap-1 truncate max-w-[44%]"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground-3)", letterSpacing: "-0.005em" }}
            >
              {change.site.name}
              <ExternalLink size={10} strokeWidth={2} className="shrink-0 opacity-50" aria-hidden />
            </span>
          )}

          <span className={`pill ${SEV_PILL[sev]}`} style={{ fontSize: 11 }}>
            {CATEGORY_LABELS[change.category]}
          </span>

          {sev >= 3 && (
            <span className={`sev-pill sev-${sev}`} style={{ fontSize: 11 }}>
              sev {sev}
            </span>
          )}

          <span
            className="ml-auto inline-flex items-center gap-1 shrink-0"
            style={{ fontSize: 11, color: "var(--foreground-4)", fontVariantNumeric: "tabular-nums" }}
          >
            <Clock size={10} strokeWidth={2} aria-hidden />
            {formatDistanceToNow(change.detectedAt)}
          </span>
        </div>

        {/* Summary — primary content */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.014em",
            color: "var(--foreground)",
            lineHeight: 1.4,
          }}
        >
          {change.summary}
        </p>

        {/* Detail — secondary content */}
        {change.detail && (
          <p
            className="mt-1 line-clamp-2"
            style={{
              fontSize: 13,
              color: "var(--foreground-3)",
              lineHeight: 1.5,
              letterSpacing: "-0.005em",
            }}
          >
            {change.detail}
          </p>
        )}
      </div>
    </Link>
  );
}
