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
      className="group relative flex"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Left severity stripe — only on notable+ */}
      <span
        aria-hidden
        className="shrink-0 self-stretch"
        style={{ width: 3, background: SEV_STRIPE[sev] }}
      />

      <div className="row-hover flex-1 px-5 py-4 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {showSite && (
            <span
              className="inline-flex items-center gap-1 truncate max-w-[42%] text-footnote"
              style={{
                color: "var(--foreground-3)",
                fontWeight: 500,
              }}
            >
              {change.site.name}
              <ExternalLink
                size={10}
                strokeWidth={2}
                className="shrink-0 opacity-60"
                aria-hidden
              />
            </span>
          )}

          <span
            className={`pill pill-${
              sev >= 4 ? "red" : sev >= 3 ? "orange" : "muted"
            }`}
          >
            {CATEGORY_LABELS[change.category]}
          </span>

          <span className="ml-auto label-mono shrink-0">
            {formatDistanceToNow(change.detectedAt)}
          </span>
        </div>

        <p
          className="text-callout-em"
          style={{
            color: "var(--foreground)",
          }}
        >
          {change.summary}
        </p>

        {change.detail && (
          <p
            className="text-footnote mt-1 line-clamp-2"
            style={{
              color: "var(--foreground-3)",
              lineHeight: 1.5,
            }}
          >
            {change.detail}
          </p>
        )}
      </div>
    </Link>
  );
}
