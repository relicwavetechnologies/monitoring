import { describe, it, expect } from "vitest";
import { sha256, gzip, gunzip } from "@/lib/pipeline/hash";

describe("sha256", () => {
  it("produces deterministic hex output", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differentiates similar inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("hello "));
    expect(sha256("HELLO")).not.toBe(sha256("hello"));
  });

  it("handles unicode", () => {
    const a = sha256("café");
    const b = sha256("café");
    expect(a).toBe(b);
    expect(a).not.toBe(sha256("cafe"));
  });
});

describe("gzip / gunzip", () => {
  it("roundtrips text losslessly", () => {
    const text = "the quick brown fox jumps over the lazy dog\n".repeat(50);
    const buf = gzip(text);
    expect(gunzip(buf)).toBe(text);
  });

  it("compresses repeated content meaningfully", () => {
    const text = "x".repeat(10_000);
    const buf = gzip(text);
    expect(buf.length).toBeLessThan(text.length / 10);
  });
});
