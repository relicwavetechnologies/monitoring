import { describe, it, expect } from "vitest";
import { getLogger } from "@/lib/logger";

describe("getLogger", () => {
  it("returns a logger with the bound component name", () => {
    const log = getLogger("test.component");
    expect(log.bindings()).toMatchObject({ component: "test.component", service: "visawatch" });
  });

  it("attaches additional bindings supplied at creation", () => {
    const log = getLogger("test.component", { siteId: "site_abc" });
    expect(log.bindings()).toMatchObject({ component: "test.component", siteId: "site_abc" });
  });

  it("supports child loggers with merged bindings", () => {
    const parent = getLogger("parent", { a: 1 });
    const child = parent.child({ b: 2 });
    expect(child.bindings()).toMatchObject({ component: "parent", a: 1, b: 2 });
  });

  it("does not throw when logging arbitrary payloads", () => {
    const log = getLogger("noop");
    expect(() => log.info({ foo: "bar" }, "hello")).not.toThrow();
    expect(() => log.error({ err: new Error("boom") }, "fail")).not.toThrow();
  });
});
