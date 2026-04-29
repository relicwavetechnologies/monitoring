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
        where: { detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
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

  const dbStats = [
    { label: "Active sites", value: siteCount.toLocaleString() },
    { label: "Active URLs", value: urlCount.toLocaleString() },
    { label: "Snapshots", value: snapCount.toLocaleString() },
    { label: "Changes", value: changeCount.toLocaleString() },
  ];

  const cost7dStats = [
    { label: "Changes", value: costSum._count.id.toLocaleString() },
    { label: "LLM cost", value: `$${cost7d.toFixed(4)}` },
    { label: "Tokens in", value: tokensIn7d.toLocaleString() },
    { label: "Tokens out", value: tokensOut7d.toLocaleString() },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-up">
      <div className="mb-8">
        <span className="eyebrow inline-block mb-3">Operations</span>
        <h1 className="hero-title">Admin</h1>
        <p className="hero-sub mt-3 max-w-2xl">
          Operational overview. For raw counters, see{" "}
          <code
            className="mono"
            style={{
              background: "var(--background-2)",
              padding: "1px 7px",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            /api/admin/metrics
          </code>
          .
        </p>
      </div>

      <Section label="Database">
        <Stats items={dbStats} />
      </Section>

      <Section label="Queue depth">
        {Object.keys(depth).length === 0 ? (
          <div
            className="surface-flat py-6 px-4 text-center"
            style={{ color: "var(--foreground-3)", fontSize: 13 }}
          >
            Queue is unreachable or not started yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(depth).map(([name, n]) => (
              <div key={name} className="surface-flat p-4">
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--foreground-3)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {name}
                </div>
                <div
                  className="tabular mt-1"
                  style={{
                    fontSize: 22,
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
        )}
      </Section>

      <Section label="Last 7 days · LLM cost">
        <Stats items={cost7dStats} />
      </Section>

      <Section label="Severity distribution (all-time)">
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((sev) => (
            <div key={sev} className="surface-flat p-3 text-center">
              <span className={`sev-pill sev-${sev}`}>sev {sev}</span>
              <div
                className="tabular mt-2"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  letterSpacing: "-0.022em",
                }}
              >
                {sevByLevel[sev] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Recent changes">
        {recentChanges.length === 0 ? (
          <div
            className="surface-flat py-6 text-center"
            style={{ color: "var(--foreground-3)", fontSize: 13 }}
          >
            No changes yet.
          </div>
        ) : (
          <div className="surface-flat overflow-hidden">
            {recentChanges.map((c, i) => (
              <div
                key={c.id}
                className="row-hover flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{
                  borderBottom:
                    i === recentChanges.length - 1 ? "none" : "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <span className={`sev-pill sev-${Math.max(1, Math.min(5, c.severity))}`}>
                  sev {c.severity}
                </span>
                <span className="pill pill-muted">{c.classifierStatus}</span>
                <span
                  className="mono"
                  style={{ color: "var(--foreground-3)", letterSpacing: "-0.005em" }}
                >
                  {c.site.name}
                </span>
                <span
                  className="flex-1 truncate"
                  style={{ color: "var(--foreground)", letterSpacing: "-0.005em" }}
                >
                  {c.summary}
                </span>
                {c.classifierCostUsd != null && (
                  <span className="mono tabular" style={{ color: "var(--foreground-3)" }}>
                    ${c.classifierCostUsd.toFixed(5)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2
        className="mb-3"
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "-0.014em",
          color: "var(--foreground-2)",
        }}
      >
        {label}
      </h2>
      {children}
    </section>
  );
}

function Stats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((s) => (
        <div key={s.label} className="surface-flat p-4">
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--foreground-3)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {s.label}
          </div>
          <div
            className="tabular mt-1.5"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "var(--foreground)",
              letterSpacing: "-0.022em",
              lineHeight: 1.1,
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
