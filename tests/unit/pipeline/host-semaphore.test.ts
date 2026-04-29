import { describe, it, expect, beforeEach } from "vitest";
import {
  withHostLock,
  semaphoreStats,
  _resetSemaphoresForTests,
} from "@/lib/pipeline/fetchers/host-semaphore";

describe("withHostLock", () => {
  beforeEach(() => _resetSemaphoresForTests());

  it("runs a single task and returns its result", async () => {
    const out = await withHostLock("a.example", async () => 42);
    expect(out).toBe(42);
  });

  it("serialises concurrent tasks for the same host (default capacity 1)", async () => {
    const order: string[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const t1 = withHostLock("a.example", async () => {
      order.push("t1-start");
      await sleep(20);
      order.push("t1-end");
      return 1;
    });
    const t2 = withHostLock("a.example", async () => {
      order.push("t2-start");
      await sleep(5);
      order.push("t2-end");
      return 2;
    });

    const [r1, r2] = await Promise.all([t1, t2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    // t2 must not start until t1 ends.
    expect(order).toEqual(["t1-start", "t1-end", "t2-start", "t2-end"]);
  });

  it("does NOT serialise tasks across different hosts", async () => {
    const order: string[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const t1 = withHostLock("a.example", async () => {
      order.push("a-start");
      await sleep(20);
      order.push("a-end");
    });
    const t2 = withHostLock("b.example", async () => {
      order.push("b-start");
      await sleep(5);
      order.push("b-end");
    });

    await Promise.all([t1, t2]);
    // Different hosts run in parallel: b-end must come before a-end.
    expect(order.indexOf("b-end")).toBeLessThan(order.indexOf("a-end"));
  });

  it("releases the slot even when the task throws", async () => {
    let secondRan = false;
    await withHostLock("c.example", async () => {
      throw new Error("boom");
    }).catch(() => {});
    await withHostLock("c.example", async () => {
      secondRan = true;
    });
    expect(secondRan).toBe(true);
    const stats = semaphoreStats()["c.example"];
    expect(stats.inFlight).toBe(0);
    expect(stats.queued).toBe(0);
  });

  it("processes a burst of tasks in FIFO order on a single host", async () => {
    const completed: number[] = [];
    const tasks = Array.from({ length: 5 }, (_, i) =>
      withHostLock("d.example", async () => {
        await new Promise((r) => setTimeout(r, 5));
        completed.push(i);
      })
    );
    await Promise.all(tasks);
    expect(completed).toEqual([0, 1, 2, 3, 4]);
  });
});
