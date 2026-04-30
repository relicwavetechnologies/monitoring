import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { queueDepth } from "@/lib/queue";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let depth: Record<string, number> = {};
  try {
    depth = await queueDepth();
  } catch {
    depth = {};
  }

  const [siteCount, urlCount, snapCount, changeCount, sevDist, costSum, recentChanges] =
    await Promise.all([
      db.site.count({ where: { isActive: true } }),
      db.monitoredUrl.count({ where: { paused: false } }),
      db.snapshot.count(),
      db.change.count(),
      db.change.groupBy({ by: ["severity"], _count: { id: true } }),
      db.change.aggregate({
        where: {
          detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: {
          classifierCostUsd: true,
          classifierTokensIn: true,
          classifierTokensOut: true,
        },
        _count: { id: true },
      }),
      db.change.findMany({
        orderBy: { detectedAt: "desc" },
        take: 10,
        select: {
          id: true,
          summary: true,
          severity: true,
          category: true,
          classifierStatus: true,
          classifierModel: true,
          classifierCostUsd: true,
          site: { select: { name: true } },
          detectedAt: true,
        },
      }),
    ]);

  const cost7d = costSum._sum.classifierCostUsd ?? 0;
  const tokensIn7d = costSum._sum.classifierTokensIn ?? 0;
  const tokensOut7d = costSum._sum.classifierTokensOut ?? 0;
  const sevByLevel = Object.fromEntries(sevDist.map((d) => [d.severity, d._count.id]));

  const STAT_LABEL = "text-caption-2";

  function statCard(label: string, value: string | number, idx: number) {
    return (
      <div
        key={label}
        className={`card-item animate-fade-up stagger-${(idx % 4) + 1}`}
      >
        <div className="stat-block-label">{label}</div>
        <div
          className="tabular mt-2"
          style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)", lineHeight: 1.1 }}
        >
          {value}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-8 animate-fade-up">
        <h1 className="hero-title">Admin</h1>
        <p className="hero-sub mt-1">
          Queue depth, costs, and classifier health.
        </p>
      </div>

      {/* DB rollups */}
      <div className="mb-8">
        <h2 className="eyebrow mb-3">Database</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Active sites", siteCount.toLocaleString()],
            ["Active URLs", urlCount.toLocaleString()],
            ["Snapshots", snapCount.toLocaleString()],
            ["Changes", changeCount.toLocaleString()],
          ].map(([l, v], i) => statCard(String(l), String(v), i))}
        </div>
      </div>

      {/* Queue */}
      <div className="mb-8">
        <h2 className="eyebrow mb-3">Queue depth</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.keys(depth).length === 0 && (
            <div
              className="col-span-full surface-flat text-footnote"
              style={{ padding: 14, color: "var(--foreground-3)" }}
            >
              Queue is unreachable or not started yet (DATABASE_URL may be missing).
            </div>
          )}
          {Object.entries(depth).map(([name, n], i) => (
            <div
              key={name}
              className={`surface-flat animate-fade-up stagger-${(i % 4) + 1}`}
              style={{ padding: "14px 16px" }}
            >
              <div className="mono text-footnote" style={{ color: "var(--foreground-3)" }}>
                {name}
              </div>
              <div
                className="tabular mt-1.5"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  letterSpacing: "-0.022em",
                  lineHeight: 1.1,
                }}
              >
                {n < 0 ? "—" : n}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Last 7 days */}
      <div className="mb-8">
        <h2 className="eyebrow mb-3">Last 7 days</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["Changes", costSum._count.id.toLocaleString()],
            ["LLM cost", `$${cost7d.toFixed(4)}`],
            ["Tokens in", tokensIn7d.toLocaleString()],
            ["Tokens out", tokensOut7d.toLocaleString()],
          ].map(([l, v], i) => statCard(String(l), String(v), i))}
        </div>
      </div>

      {/* Severity distribution */}
      <div className="mb-8">
        <h2 className="eyebrow mb-3">Severity distribution · all-time</h2>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((sev) => (
            <div
              key={sev}
              className="surface-flat text-center"
              style={{ padding: "14px 10px" }}
            >
              <div
                className="text-caption-2"
                style={{ color: "var(--foreground-3)" }}
              >
                SEV {sev}
              </div>
              <div
                className="tabular mt-1.5"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color:
                    sev >= 4
                      ? "var(--red-ink)"
                      : sev >= 3
                      ? "var(--orange-ink)"
                      : "var(--foreground)",
                  letterSpacing: "-0.022em",
                  lineHeight: 1,
                }}
              >
                {sevByLevel[sev] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent changes */}
      <div>
        <h2 className="eyebrow mb-3">Recent changes</h2>
        {recentChanges.length === 0 ? (
          <div
            className="surface-flat text-center text-subhead"
            style={{
              padding: "32px 20px",
              color: "var(--foreground-3)",
              borderStyle: "dashed",
            }}
          >
            No changes yet.
          </div>
        ) : (
          <div className="surface-flat overflow-hidden">
            {recentChanges.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-5 py-3 row-hover"
                style={{
                  borderBottom:
                    i === recentChanges.length - 1 ? "none" : "1px solid var(--border)",
                }}
              >
                <span className={`sev-pill sev-${c.severity}`}>
                  sev {c.severity}
                </span>
                <span
                  className={`pill pill-${
                    c.classifierStatus === "VALIDATED"
                      ? "green"
                      : c.classifierStatus === "CLAMPED"
                      ? "indigo"
                      : c.classifierStatus === "UNGROUNDED"
                      ? "orange"
                      : "muted"
                  }`}
                >
                  {c.classifierStatus}
                </span>
                <span
                  className="text-footnote mono shrink-0 truncate max-w-[140px]"
                  style={{ color: "var(--foreground-3)" }}
                >
                  {c.site.name}
                </span>
                <span
                  className="flex-1 truncate text-subhead"
                  style={{ color: "var(--foreground)" }}
                >
                  {c.summary}
                </span>
                {c.classifierCostUsd != null && (
                  <span
                    className="mono shrink-0 tabular text-footnote"
                    style={{ color: "var(--foreground-4)" }}
                  >
                    ${c.classifierCostUsd.toFixed(5)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
