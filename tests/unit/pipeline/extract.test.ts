import { describe, it, expect } from "vitest";
import { extractContent } from "@/lib/pipeline/extract";
import { loadFixture } from "../../helpers/fixtures";

describe("extractContent", () => {
  it("strips script/style/cookie noise", () => {
    const html = `
      <html><body>
        <script>console.log('tracker')</script>
        <style>.x{color:red}</style>
        <div class="cookie-banner">accept cookies</div>
        <main>real content here</main>
      </body></html>`;
    const text = extractContent(html, "main", []);
    expect(text).toContain("real content");
    expect(text).not.toContain("tracker");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("accept cookies");
  });

  it("falls back to body when selector matches nothing", () => {
    const html = `<html><body><p>fallback works</p></body></html>`;
    const text = extractContent(html, ".does-not-exist", []);
    expect(text).toContain("fallback works");
  });

  it("normalises whitespace", () => {
    const html = `<html><body><main>a\t\tb   c\n\n\n\nd</main></body></html>`;
    const text = extractContent(html, "main", []);
    expect(text).not.toMatch(/\t/);
    expect(text).not.toMatch(/   /);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("applies user-defined strip patterns", () => {
    const html = `<html><body><main>visa fee 2026-04-29T12:00:00Z is $185</main></body></html>`;
    const text = extractContent(html, "main", ["\\d{4}-\\d{2}-\\d{2}T[\\d:]+Z"]);
    expect(text).not.toMatch(/2026-04-29T/);
    expect(text).toContain("$185");
  });

  it("silently ignores invalid regex strip patterns", () => {
    const html = `<html><body><main>some text</main></body></html>`;
    expect(() => extractContent(html, "main", ["[unclosed"])).not.toThrow();
  });

  describe("on real-shape fixtures", () => {
    it("extracts the visa-services block from the usembassy baseline", () => {
      const fx = loadFixture("in.usembassy.gov", "2026-04-29-baseline");
      const text = extractContent(fx.html, "main", []);
      expect(text).toContain("Standard visa application fee");
      expect(text).toContain("$185");
      expect(text).not.toContain("dataLayer");
      expect(text).not.toContain("display:none");
      expect(text).not.toMatch(/cookie/i);
    });

    it("produces a different string for the fee-change fixture", () => {
      const a = extractContent(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        "main",
        []
      );
      const b = extractContent(
        loadFixture("in.usembassy.gov", "2026-04-30-fee-change").html,
        "main",
        []
      );
      expect(a).not.toBe(b);
      expect(b).toContain("$205");
      expect(a).toContain("$185");
      expect(b).not.toContain("$185");
    });

    it("produces near-identical text for the cosmetic-only fixture", () => {
      const a = extractContent(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        "main",
        []
      );
      const c = extractContent(
        loadFixture("in.usembassy.gov", "2026-04-30-cosmetic").html,
        "main",
        []
      );
      // The cosmetic fixture only changes header/footer + tracker timestamp +
      // cookie-banner button label, none of which lives inside <main>.
      expect(a).toBe(c);
    });
  });
});
