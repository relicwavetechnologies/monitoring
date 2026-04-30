"use client";

import { useMemo, useState } from "react";

const DAYS_BACK = 30;

// Brand-tinted scale matched to the dashboard's design tokens. Severity 0 (no
// change) is a near-empty wash, 5 is full red.
const SEV_COLOR: Record<number, string> = {
  0: "rgba(108,99,255,0.05)",
  1: "rgba(108,99,255,0.18)",
  2: "rgba(108,99,255,0.38)",
  3: "rgba(217,119,6,0.78)",
  4: "rgba(239,68,68,0.88)",
  5: "rgba(220,38,38,1.00)",
};

interface ChangePoint {
  detectedAt: string; // ISO string — passed from a Server Component
  severity: number;
  monitoredUrlId: string | null;
  siteId: string;
}

interface RowKey {
  monitoredUrlId: string | null; // null for sites with no MonitoredUrl rows yet
  siteId: string;
  siteName: string;
  urlPath: string; // shortened path, e.g. "/visa/apply"
}

interface Props {
  rows: RowKey[];
  changes: ChangePoint[];
}

export function ActivityHeatmap({ rows, changes }: Props) {
  const [hover, setHover] = useState<{
    label: string;
    sev: number;
    count: number;
    date: string;
    x: number;
    y: number;
  } | null>(null);

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }, []);

  // Group changes: rowKey -> dayKey -> { sev, count }
  const buckets = useMemo(() => {
    const map = new Map<string, Map<string, { sev: number; count: number }>>();
    for (const c of changes) {
      const rk = `${c.siteId}::${c.monitoredUrlId ?? ""}`;
      const day = new Date(c.detectedAt);
      day.setHours(0, 0, 0, 0);
      const dayKey = day.toISOString().slice(0, 10);
      if (!map.has(rk)) map.set(rk, new Map());
      const inner = map.get(rk)!;
      const cur = inner.get(dayKey) ?? { sev: 0, count: 0 };
      inner.set(dayKey, {
        sev: Math.max(cur.sev, c.severity),
        count: cur.count + 1,
      });
    }
    return map;
  }, [changes]);

  if (rows.length === 0) {
    return (
      <div
        className="text-center py-10 text-sm rounded-lg"
        style={{
          color: "var(--foreground-4)",
          border: "1px dashed var(--border)",
        }}
      >
        No URLs to display yet.
      </div>
    );
  }

  const cellSize = 13;
  const cellGap = 2;
  const labelWidth = 220;
  const headerHeight = 22;
  const chartWidth = labelWidth + DAYS_BACK * (cellSize + cellGap);
  const chartHeight = headerHeight + rows.length * (cellSize + cellGap);

  return (
    <div className="relative overflow-x-auto">
      <svg width={chartWidth} height={chartHeight} className="block">
        {/* Day axis labels — sparse */}
        {[0, Math.floor(DAYS_BACK / 2), DAYS_BACK - 1].map((i) => {
          const d = days[i];
          return (
            <text
              key={i}
              x={labelWidth + i * (cellSize + cellGap) + cellSize / 2}
              y={headerHeight - 8}
              fontSize={9.5}
              fontFamily="var(--font-mono, ui-monospace, monospace)"
              fill="var(--foreground-4)"
              textAnchor="middle"
            >
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          );
        })}

        {rows.map((row, rowIdx) => {
          const rk = `${row.siteId}::${row.monitoredUrlId ?? ""}`;
          const fullLabel = `${row.siteName} · ${row.urlPath}`;
          const visibleLabel =
            fullLabel.length > 32 ? fullLabel.slice(0, 30) + "…" : fullLabel;
          const y = headerHeight + rowIdx * (cellSize + cellGap);

          return (
            <g key={rk} transform={`translate(0, ${y})`}>
              <text
                x={labelWidth - 8}
                y={cellSize - 3}
                fontSize={11}
                fontFamily="var(--font-sans, ui-sans-serif, system-ui)"
                fill="var(--foreground-3)"
                textAnchor="end"
                style={{ cursor: "default" }}
              >
                <title>{fullLabel}</title>
                {visibleLabel}
              </text>

              {days.map((d, colIdx) => {
                const dayKey = d.toISOString().slice(0, 10);
                const cell = buckets.get(rk)?.get(dayKey);
                const sev = cell?.sev ?? 0;
                const count = cell?.count ?? 0;
                const fill = SEV_COLOR[Math.min(5, sev) as 0 | 1 | 2 | 3 | 4 | 5];
                const x = labelWidth + colIdx * (cellSize + cellGap);
                return (
                  <rect
                    key={colIdx}
                    x={x}
                    y={0}
                    width={cellSize}
                    height={cellSize}
                    rx={2}
                    fill={fill}
                    stroke={cell ? "transparent" : "var(--border)"}
                    strokeWidth={cell ? 0 : 1}
                    onMouseEnter={() =>
                      setHover({
                        label: fullLabel,
                        sev,
                        count,
                        date: d.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }),
                        x: x + cellSize / 2,
                        y,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: count ? "pointer" : "default" }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none px-2.5 py-1.5 rounded-md shadow-lg z-10"
          style={{
            left: hover.x + 8,
            top: hover.y - 36,
            background: "rgba(13,13,28,0.95)",
            color: "#fff",
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600 }}>{hover.label}</div>
          <div style={{ opacity: 0.7, marginTop: 1 }}>
            {hover.date} · {hover.count === 0 ? "no changes" : `${hover.count} change${hover.count === 1 ? "" : "s"}`}
            {hover.sev > 0 && ` · max sev ${hover.sev}`}
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        className="flex items-center gap-2 mt-3"
        style={{
          fontSize: 10.5,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          color: "var(--foreground-4)",
        }}
      >
        <span>less</span>
        {[0, 1, 2, 3, 4, 5].map((sev) => (
          <div
            key={sev}
            className="rounded-sm"
            style={{ width: 11, height: 11, background: SEV_COLOR[sev] }}
            title={sev === 0 ? "no change" : `severity ${sev}`}
          />
        ))}
        <span>more</span>
        <span className="ml-auto">last {DAYS_BACK} days</span>
      </div>
    </div>
  );
}
