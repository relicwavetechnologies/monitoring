/**
 * Phase 8: render a MonitoredUrl topic card as a tile.
 *
 * - Category badge in the top-left
 * - Title + summary
 * - lastChangeNote shown as an orange "what's new" strip when present
 * - Click opens the URL detail page
 */
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "@/lib/time";

export type Category = "POLICY" | "FEES" | "APPOINTMENTS" | "DOCUMENTS" | "NEWS" | "OTHER" | "SKIP";

export interface TopicCardData {
  title: string;
  summary: string;
  category: Category;
  importantFields: string[];
  contentSelector?: string | null;
  lastChangeNote?: string | null;
  lastChangeAt?: string | null;
}

interface TileProps {
  /** UrlId for routing */
  urlId: string;
  /** Display URL (the path is shown small under the title). */
  url: string;
  card: TopicCardData | null;
  /** Optional fallback title when there's no card (rare). */
  fallbackTitle?: string;
  paused?: boolean;
  failureKind?: string | null;
  consecutiveFailures?: number;
  lastCheckedAt?: Date | null;
}

const CATEGORY_COLORS: Record<Category, { bg: string; ink: string }> = {
  POLICY: { bg: "rgba(99,102,241,0.10)", ink: "#4338CA" },
  FEES: { bg: "rgba(34,197,94,0.10)", ink: "#15803D" },
  APPOINTMENTS: { bg: "rgba(234,88,12,0.10)", ink: "#C2410C" },
  DOCUMENTS: { bg: "rgba(14,165,233,0.10)", ink: "#0369A1" },
  NEWS: { bg: "rgba(168,85,247,0.10)", ink: "#7E22CE" },
  OTHER: { bg: "rgba(115,115,115,0.10)", ink: "#525252" },
  SKIP: { bg: "rgba(115,115,115,0.06)", ink: "#737373" },
};

export function TopicCardTile({
  urlId,
  url,
  card,
  fallbackTitle,
  paused,
  failureKind,
  consecutiveFailures,
  lastCheckedAt,
}: TileProps) {
  const cat = (card?.category ?? "OTHER") as Category;
  const palette = CATEGORY_COLORS[cat];
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  const hasChange = !!card?.lastChangeNote;
  const isUnhealthy = (consecutiveFailures ?? 0) > 0 && failureKind;

  return (
    <Link
      href={`/urls/${urlId}`}
      className="group block"
      style={{
        background: "var(--background-1)",
        border: `1px solid ${
          hasChange
            ? "color-mix(in srgb, var(--orange) 35%, var(--border))"
            : "var(--border)"
        }`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 120ms ease, transform 120ms ease",
      }}
    >
      {hasChange && (
        <div
          style={{
            background: "color-mix(in srgb, var(--orange) 14%, transparent)",
            color: "var(--orange-ink)",
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid color-mix(in srgb, var(--orange) 25%, var(--border))",
          }}
        >
          <span className="status-dot" style={{ background: "var(--orange-ink)" }} />
          <span className="line-clamp-1 flex-1">{card!.lastChangeNote}</span>
        </div>
      )}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="flex items-start justify-between gap-2">
          <span
            className="pill shrink-0"
            style={{
              background: palette.bg,
              color: palette.ink,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {cat}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {paused && (
              <span className="pill pill-muted" style={{ fontSize: 10 }}>
                paused
              </span>
            )}
            {isUnhealthy && (
              <span
                className="pill"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  color: "#B91C1C",
                  fontSize: 10,
                  fontWeight: 600,
                }}
                title={`${consecutiveFailures} consecutive ${failureKind} failures`}
              >
                {failureKind}
              </span>
            )}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: "-0.012em",
              color: "var(--foreground)",
              lineHeight: 1.35,
            }}
          >
            {card?.title ?? fallbackTitle ?? path}
          </div>
          <div
            className="mono mt-1 truncate flex items-center gap-1"
            style={{ fontSize: 11, color: "var(--foreground-4)" }}
            title={url}
          >
            {path}
            <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
          </div>
        </div>
        {card?.summary && (
          <p
            className="line-clamp-3"
            style={{
              fontSize: 12.5,
              color: "var(--foreground-2)",
              lineHeight: 1.5,
            }}
          >
            {card.summary}
          </p>
        )}
        {card && card.importantFields.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.importantFields.slice(0, 4).map((f) => (
              <span
                key={f}
                className="pill pill-muted"
                style={{ fontSize: 10, padding: "2px 6px" }}
              >
                {f}
              </span>
            ))}
            {card.importantFields.length > 4 && (
              <span
                className="pill pill-muted"
                style={{ fontSize: 10, padding: "2px 6px" }}
              >
                +{card.importantFields.length - 4}
              </span>
            )}
          </div>
        )}
        <div
          className="flex items-center gap-3 mt-1"
          style={{ fontSize: 11, color: "var(--foreground-4)" }}
        >
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            {lastCheckedAt ? formatDistanceToNow(lastCheckedAt) : "Never polled"}
          </span>
          {card?.lastChangeAt && (
            <span style={{ color: "var(--orange-ink)" }}>
              · changed {formatDistanceToNow(new Date(card.lastChangeAt))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
