import { db } from "@/lib/db";
import { parseNotices } from "@/lib/parse-notices";
import { Sparkles, ArrowUpRight } from "lucide-react";

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
    b.severity !== a.severity ? b.severity - a.severity : a.siteName.localeCompare(b.siteName)
  );

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(108,99,255,0.08)",
            border: "1px solid rgba(108,99,255,0.20)",
            borderRadius: 100,
            padding: "3px 10px",
          }}
        >
          <Sparkles style={{ width: 11, height: 11, color: "#6C63FF" }} strokeWidth={2.5} />
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6C63FF",
            }}
          >
            AI Insights
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--foreground-3, #9494B0)", fontStyle: "italic" }}>
          Pinpointed from site analysis — not a detected change
        </span>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 10,
        }}
      >
        {allNotices.map((notice, i) => (
          <a
            key={`${notice.siteId}-${i}`}
            href={notice.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-notice-card"
            style={{
              display: "block",
              textDecoration: "none",
              background: "var(--background-1, #F5F5FC)",
              border: "1px solid var(--border, #E8E8F2)",
              borderLeft: `3px solid ${notice.color}`,
              borderRadius: 6,
              padding: "14px 16px 12px",
              cursor: "pointer",
            }}
          >
            {/* Top row: severity badge + site pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                gap: 8,
              }}
            >
              {/* Severity badge */}
              <span
                style={{
                  display: "inline-block",
                  background: notice.bg,
                  color: notice.color,
                  border: `1px solid ${notice.border}`,
                  padding: "2px 8px",
                  borderRadius: 100,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {notice.label}
              </span>

              {/* Site name pill — styled as a clickable tag */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 9.5,
                  color: "#6C63FF",
                  background: "rgba(108,99,255,0.07)",
                  border: "1px solid rgba(108,99,255,0.18)",
                  padding: "2px 7px 2px 8px",
                  borderRadius: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 165,
                  flexShrink: 1,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {notice.siteName}
                </span>
                <ArrowUpRight style={{ width: 9, height: 9, flexShrink: 0 }} strokeWidth={2.5} />
              </span>
            </div>

            {/* Notice text */}
            <p
              style={{
                fontSize: 13,
                color: "var(--foreground, #0D0D1C)",
                lineHeight: 1.55,
                margin: "0 0 12px",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {notice.text}
            </p>

            {/* Footer: "View site analysis →" */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                color: "var(--foreground-3, #9494B0)",
                letterSpacing: "0.03em",
              }}
            >
              <span>Visit site</span>
              <ArrowUpRight style={{ width: 10, height: 10 }} strokeWidth={2} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
