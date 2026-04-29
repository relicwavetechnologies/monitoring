import { describe, it, expect } from "vitest";
import { QUEUES, RETRY_POLICY, RETENTION } from "@/lib/queue/jobs";

describe("queue/jobs constants", () => {
  it("declares the four queue names", () => {
    expect(Object.values(QUEUES).sort()).toEqual(
      ["email.send", "email.sweep", "tick.scan", "url.poll"]
    );
  });

  it("retry policy covers every queue", () => {
    for (const name of Object.values(QUEUES)) {
      expect(RETRY_POLICY[name]).toBeDefined();
    }
  });

  it("url.poll + email.send have retry budgets, sweep + tick do not", () => {
    expect(RETRY_POLICY[QUEUES.URL_POLL].retryLimit).toBeGreaterThan(0);
    expect(RETRY_POLICY[QUEUES.EMAIL_SEND].retryLimit).toBeGreaterThan(0);
    expect(RETRY_POLICY[QUEUES.EMAIL_SWEEP].retryLimit).toBe(0);
    expect(RETRY_POLICY[QUEUES.TICK_SCAN].retryLimit).toBe(0);
  });

  it("retention values are sensible", () => {
    expect(RETENTION.COMPLETED).toBeGreaterThan(60 * 60 * 24); // > 1 day
    expect(RETENTION.FAILED).toBeGreaterThan(RETENTION.COMPLETED); // failed kept longer
  });
});
