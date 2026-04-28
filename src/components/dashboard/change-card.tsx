import Link from "next/link";
import { formatDistanceToNow } from "@/lib/time";
import { ExternalLink } from "lucide-react";
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
  POLICY_CHANGE:        "Policy",
  FEE_CHANGE:           "Fee",
  APPOINTMENT:          "Appointment",
  DOCUMENT_REQUIREMENT: "Documents",
  NAVIGATION:           "Navigation",
  COSMETIC:             "Cosmetic",
  UNKNOWN:              "Unknown",
};

// Accent-line colour for severity — just a thin strip, nothing more
const SEV_COLOR: Record<number, string> = {
  1: "#D4D4E8",
  2: "#9494B0",
  3: "#D97706",
  4: "#EF4444",
  5: "#DC2626",
};

const SEV_LABEL: Record<number, string> = {
  1: "minimal",
  2: "minor",
  3: "notable",
  4: "important",
  5: "critical",
};

export function ChangeCard({ change, showSite = true }: ChangeCardProps) {
  const sev = Math.max(1, Math.min(5, change.severity));
  const accentColor = SEV_COLOR[sev];

  return (
    <div
      className="group relative flex gap-0"
      style={{ borderBottom: "1px solid var(--border, #E8E8F2)" }}
    >
      {/* Left severity strip — 2px, full height */}
      <div
        className="shrink-0 w-0.5 rounded-full my-4"
        style={{ background: accentColor, marginLeft: 0 }}
      />

      {/* Content */}
      <div className="flex-1 py-4 px-4 min-w-0">
        {/* Top meta row */}
        <div className="flex items-center gap-2 mb-2">
          {/* Site name */}
          {showSite && (
            <Link
              href={`/sites/${change.site.id}`}
              className="flex items-center gap-1 transition-colors"
              style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--foreground-3, #9494B0)" }}
            >
              {change.site.name}
              <ExternalLink size={10} />
            </Link>
          )}

          {/* Category — mono uppercase, no background */}
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: accentColor,
            }}
          >
            {CATEGORY_LABELS[change.category]}
          </span>

          {/* Severity label — only when notable+ */}
          {sev >= 3 && (
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                color: "var(--foreground-3, #9494B0)",
              }}
            >
              · {SEV_LABEL[sev]}
            </span>
          )}

          {/* Timestamp — pushed right */}
          <span
            className="ml-auto"
            style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--foreground-3, #9494B0)" }}
          >
            {formatDistanceToNow(change.detectedAt)}
          </span>
        </div>

        {/* Summary — the main event */}
        <Link href={`/changes/${change.id}`} className="group/link block">
          <p
            className="text-sm font-semibold leading-snug transition-colors group-hover/link:underline"
            style={{
              color: "var(--foreground, #0D0D1C)",
              textUnderlineOffset: 2,
            }}
          >
            {change.summary}
          </p>
        </Link>

        {/* Detail — one line, muted */}
        {change.detail && (
          <p
            className="mt-1 line-clamp-1"
            style={{ fontSize: 13, color: "var(--foreground-2, #5A5A7A)", lineHeight: 1.55 }}
          >
            {change.detail}
          </p>
        )}
      </div>
    </div>
  );
}
