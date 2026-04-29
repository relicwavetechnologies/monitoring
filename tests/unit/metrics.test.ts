import { describe, it, expect, beforeEach } from "vitest";
import {
  incrCounter,
  snapshot,
  toPrometheusText,
  _resetMetricsForTests,
} from "@/lib/metrics";

describe("metrics", () => {
  beforeEach(() => _resetMetricsForTests());

  it("starts with zero counters", () => {
    expect(Object.keys(snapshot().counters)).toEqual([]);
  });

  it("increments a label-less counter", () => {
    incrCounter("widgets_total");
    incrCounter("widgets_total");
    incrCounter("widgets_total");
    const snap = snapshot();
    expect(snap.counters.widgets_total).toEqual([{ labels: {}, value: 3 }]);
  });

  it("buckets label combinations independently", () => {
    incrCounter("polls_total", { site: "a", status: "ok" });
    incrCounter("polls_total", { site: "a", status: "ok" });
    incrCounter("polls_total", { site: "a", status: "fail" });
    incrCounter("polls_total", { site: "b", status: "ok" });
    const series = snapshot().counters.polls_total;
    expect(series).toHaveLength(3);
    const okA = series.find((s) => s.labels.site === "a" && s.labels.status === "ok");
    expect(okA?.value).toBe(2);
  });

  it("treats label order as irrelevant", () => {
    incrCounter("c", { a: "1", b: "2" });
    incrCounter("c", { b: "2", a: "1" });
    expect(snapshot().counters.c).toHaveLength(1);
    expect(snapshot().counters.c[0].value).toBe(2);
  });

  it("renders Prometheus text format", () => {
    incrCounter("c_total", { kind: "x" }, 5);
    const text = toPrometheusText();
    expect(text).toContain("# TYPE c_total counter");
    expect(text).toContain('c_total{kind="x"} 5');
    expect(text).toContain("visawatch_uptime_seconds");
  });

  it("escapes special characters in label values", () => {
    incrCounter("e", { msg: 'has "quotes" and \\back\\' });
    const text = toPrometheusText();
    expect(text).toContain('msg="has \\"quotes\\" and \\\\back\\\\"');
  });
});
