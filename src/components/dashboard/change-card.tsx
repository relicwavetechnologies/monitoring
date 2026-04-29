import Link from "next/link";
import { formatDistanceToNow } from "@/lib/time";
import { ExternalLink } from "lucide-react";
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

// Accent stripe colour per severity using the new system tokens.
const SEV_STRIPE: Record<number, string> = {
  1: "var(--border-2)",
  2: "var(--foreground-4)",
  3: "var(--orange)",
  4: "var(--red)",
  5: "var(--red)",
};

export function ChangeCard({ change, showSite = true }: ChangeCardProps) {
  const sev = Math.max(1, Math.min(5, change.severity));
  const stripe = SEV_STRIPE[sev];

  return (
    <Link
      href={`/changes/${change.id}`}
      className="group relative flex transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Left severity stripe — 3px wide, only visible on notable+ */}
      <span
        aria-hidden
        className="shrink-0 self-stretch"
        style={{
          width: 3,
          background: sev >= 3 ? stripe : "transparent",
        }}
      />

      <div className="row-hover flex-1 px-5 py-4 min-w-0">
        {/* Top meta row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {showSite && (
            <span
              className="inline-flex items-center gap-1 truncate max-w-[40%]"
              style={{
                fontSize: 12,
                color: "var(--foreground-3)",
                fontWeight: 500,
                letterSpacing: "-0.011em",
              }}
            >
              {change.site.name}
              <ExternalLink size={10} strokeWidth={2} className="shrink-0 opacity-70" />
            </span>
          )}

          <span className={`pill pill-${sev >= 4 ? "red" : sev >= 3 ? "orange" : "muted"}`}>
            {CATEGORY_LABELS[change.category]}
          </span>

          <span className="ml-auto label-mono shrink-0">
            {formatDistanceToNow(change.detectedAt)}
          </span>
        </div>

        <p
          className="leading-snug"
          style={{
            color: "var(--foreground)",
            fontWeight: 600,
            fontSize: 14.5,
            letterSpacing: "-0.014em",
          }}
        >
          {change.summary}
        </p>

        {change.detail && (
          <p
            className="mt-1 line-clamp-2"
            style={{
              fontSize: 13.5,
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
