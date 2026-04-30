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

const SEV_COLOR: Record<number, string> = {
  1: "transparent",
  2: "transparent",
  3: "var(--orange)",
  4: "var(--red)",
  5: "var(--red)",
};

const SEV_PILL: Record<number, string> = {
  1: "pill-muted",
  2: "pill-muted",
  3: "pill-orange",
  4: "pill-red",
  5: "pill-red",
};

export function ChangeCard({ change, showSite = true }: ChangeCardProps) {
  const sev = Math.max(1, Math.min(5, change.severity));
  const hasSevColor = sev >= 3;

  return (
    <Link
      href={`/changes/${change.id}`}
      className="group block"
      style={{
        background: "var(--background-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--border-2)";
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Severity accent bar — only sev 3+ */}
      {hasSevColor && (
        <div
          aria-hidden
          style={{ height: 3, background: SEV_COLOR[sev] }}
        />
      )}

      <div style={{ padding: "16px 18px" }}>
        {/* Top row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          {showSite && (
            <span
              className="inline-flex items-center gap-1 max-w-[46%] truncate"
              style={{ fontSize: 11.5, fontWeight: 600, color: "var(--foreground-3)" }}
            >
              {change.site.name}
              <ExternalLink size={9} strokeWidth={2} className="shrink-0 opacity-50" aria-hidden />
            </span>
          )}

          <span className={`pill ${SEV_PILL[sev]}`} style={{ fontSize: 10.5, padding: "1px 8px" }}>
            {CATEGORY_LABELS[change.category]}
          </span>

          <span
            className="ml-auto inline-flex items-center gap-1 shrink-0"
            style={{ fontSize: 11, color: "var(--foreground-4)", fontVariantNumeric: "tabular-nums" }}
          >
            <Clock size={10} strokeWidth={2} aria-hidden />
            {formatDistanceToNow(change.detectedAt)}
          </span>
        </div>

        {/* Summary */}
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            color: "var(--foreground)",
            lineHeight: 1.4,
          }}
        >
          {change.summary}
        </p>

        {/* Detail */}
        {change.detail && (
          <p
            className="mt-1.5 line-clamp-2"
            style={{
              fontSize: 12.5,
              color: "var(--foreground-3)",
              lineHeight: 1.55,
            }}
          >
            {change.detail}
          </p>
        )}
      </div>
    </Link>
  );
}
