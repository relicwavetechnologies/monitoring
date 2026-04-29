import { db } from "@/lib/db";
import { parseNotices } from "@/lib/parse-notices";
import { Sparkles, ArrowUpRight } from "lucide-react";

/**
 * Map the legacy parseNotices severity color into a tone bucket so we
 * can render with the new design tokens (.pill / .surface) instead of
 * raw HEX values.
 */
function tone(severity: number): "red" | "orange" | "muted" {
  if (severity >= 4) return "red";
  if (severity >= 3) return "orange";
  return "muted";
}

const STRIPE: Record<"red" | "orange" | "muted", string> = {
  red: "var(--red)",
  orange: "var(--orange)",
  muted: "var(--border-2)",
};

export async function AiNoticeCards() {
  const sites = await db.site.findMany({
    where: { aiAnalysis: { not: null } },
    select: { id: true, name: true, url: true, aiAnalysis: true },
  });

  if (sites.length === 0) return null;

  const allNotices = sites.flatMap((site) =>
    parseNotices(site.aiAnalysis!, { id: site.id, name: site.name, url: site.url })
  );

  if (allNotices.length === 0) return null;

  allNotices.sort((a, b) =>
    b.severity !== a.severity
      ? b.severity - a.severity
      : a.siteName.localeCompare(b.siteName)
  );

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="pill pill-blue">
          <Sparkles className="h-3 w-3" strokeWidth={2.4} />
          AI Insights
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: "var(--foreground-3)",
            letterSpacing: "-0.005em",
          }}
        >
          Pinpointed from site analysis — not detected changes
        </span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}
      >
        {allNotices.map((notice, i) => {
          const t = tone(notice.severity);
          return (
            <a
              key={`${notice.siteId}-${i}`}
              href={notice.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="surface-raised animate-fade-up"
              style={{
                display: "block",
                textDecoration: "none",
                padding: "16px 18px 14px",
                borderLeft: `3px solid ${STRIPE[t]}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span className={`pill pill-${t}`}>{notice.label}</span>
                <span
                  className="ml-auto pill pill-blue truncate"
                  style={{ maxWidth: 175 }}
                >
                  <span className="truncate">{notice.siteName}</span>
                  <ArrowUpRight className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} />
                </span>
              </div>

              <p
                className="line-clamp-3"
                style={{
                  fontSize: 13.5,
                  color: "var(--foreground)",
                  lineHeight: 1.5,
                  margin: 0,
                  letterSpacing: "-0.011em",
                }}
              >
                {notice.text}
              </p>

              <div
                className="flex items-center gap-1 mt-3 label-mono"
              >
                <span>Visit site</span>
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
