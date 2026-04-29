/**
 * Lightweight in-process metrics. Counters and histograms accumulate in
 * memory; the admin metrics endpoint exposes them in Prometheus text
 * format. Restart resets them — that's fine for now since we don't have
 * a Prometheus server scraping yet; this is for ad-hoc inspection and
 * a future scrape integration.
 *
 * Pure-ish module: no I/O, no globals beyond the module-level Maps. Safe
 * to import from anywhere, including hot pipeline paths.
 */

interface CounterValue {
  labels: Record<string, string>;
  value: number;
}

const counters = new Map<string, CounterValue[]>();
const startedAt = Date.now();

function labelKey(labels: Record<string, string>): string {
  // Stable, label-name-sorted string — same labels always hash the same.
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

export function incrCounter(name: string, labels: Record<string, string> = {}, by = 1): void {
  const list = counters.get(name) ?? [];
  const key = labelKey(labels);
  const existing = list.find((v) => labelKey(v.labels) === key);
  if (existing) {
    existing.value += by;
  } else {
    list.push({ labels, value: by });
  }
  counters.set(name, list);
}

/** Snapshot the current state — used by the admin endpoint. */
export function snapshot(): { counters: Record<string, CounterValue[]>; uptimeSeconds: number } {
  const out: Record<string, CounterValue[]> = {};
  for (const [name, vals] of counters) out[name] = vals.map((v) => ({ ...v }));
  return { counters: out, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) };
}

/** Format the current snapshot as Prometheus exposition format. */
export function toPrometheusText(): string {
  const lines: string[] = [];
  lines.push(`# HELP visawatch_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE visawatch_uptime_seconds gauge`);
  lines.push(`visawatch_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`);
  for (const [name, values] of counters) {
    lines.push(`# TYPE ${name} counter`);
    for (const v of values) {
      const lbls = Object.entries(v.labels)
        .map(([k, val]) => `${k}="${escapeLabel(val)}"`)
        .join(",");
      lines.push(lbls.length > 0 ? `${name}{${lbls}} ${v.value}` : `${name} ${v.value}`);
    }
  }
  return lines.join("\n") + "\n";
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Test seam — clears all counters. Production never calls this. */
export function _resetMetricsForTests(): void {
  counters.clear();
}
