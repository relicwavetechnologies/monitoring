import { describe, it, expect } from "vitest";
import { extractBlocks, computeBlocksHash } from "@/lib/pipeline/extract-blocks";
import { loadFixture } from "../../helpers/fixtures";

const NO_OPTS = { selector: "main", stripPatterns: [] };

describe("extractBlocks", () => {
  it("emits one block per heading / paragraph / list item", () => {
    const html = `<html><body><main>
      <h1>Welcome</h1>
      <p>The fee is $185.</p>
      <ul><li>Tourist</li><li>Student</li></ul>
    </main></body></html>`;
    const r = extractBlocks(html, NO_OPTS);
    expect(r.strategy).toBe("SELECTOR");
    expect(r.blocks).toHaveLength(4);
    expect(r.blocks.map((b) => b.kind)).toEqual(["h1", "p", "li", "li"]);
    expect(r.blocks.map((b) => b.text)).toEqual([
      "Welcome",
      "The fee is $185.",
      "Tourist",
      "Student",
    ]);
  });

  it("skips empty / whitespace-only blocks", () => {
    const html = `<html><body><main>
      <p>   </p>
      <p>real content</p>
      <p></p>
    </main></body></html>`;
    const r = extractBlocks(html, NO_OPTS);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].text).toBe("real content");
  });

  it("does not double-count text from nested block elements", () => {
    // The wrapping <p> contains an <li>; only the leaf <li> should emit a block.
    const html = `<html><body><main><p>outer text<ul><li>inner</li></ul></p></main></body></html>`;
    const r = extractBlocks(html, NO_OPTS);
    const texts = r.blocks.map((b) => b.text);
    expect(texts).toContain("inner");
    expect(texts).not.toContain("outer text inner");
  });

  it("strips script / style / cookie noise before block walk", () => {
    const html = `<html><body><main>
      <script>tracker</script>
      <style>.x{}</style>
      <div class="cookie-banner">accept</div>
      <p>real content</p>
    </main></body></html>`;
    const r = extractBlocks(html, NO_OPTS);
    expect(r.blocks.map((b) => b.text)).toEqual(["real content"]);
  });

  it("falls back to BODY strategy when the selector matches nothing", () => {
    const html = `<html><body><p>orphan paragraph</p></body></html>`;
    const r = extractBlocks(html, { selector: ".does-not-exist", stripPatterns: [] });
    expect(r.strategy).toBe("BODY");
    expect(r.blocks.map((b) => b.text)).toEqual(["orphan paragraph"]);
  });

  it("applies strip patterns per-block", () => {
    const html = `<html><body><main><p>fee 2026-04-29T10:00:00Z is $185</p></main></body></html>`;
    const r = extractBlocks(html, {
      selector: "main",
      stripPatterns: ["\\d{4}-\\d{2}-\\d{2}T[\\d:]+Z"],
    });
    expect(r.blocks[0].text).not.toMatch(/2026-04-29T/);
    expect(r.blocks[0].text).toContain("$185");
  });

  it("hashes are reorder-stable: same blocks in any order yield the same blocksHash", () => {
    const a = extractBlocks(
      `<html><body><main><p>alpha</p><p>beta</p><p>gamma</p></main></body></html>`,
      NO_OPTS
    );
    const b = extractBlocks(
      `<html><body><main><p>gamma</p><p>alpha</p><p>beta</p></main></body></html>`,
      NO_OPTS
    );
    expect(a.blocksHash).toBe(b.blocksHash);
  });

  it("hashes differ when a block's text actually changes", () => {
    const before = extractBlocks(
      `<html><body><main><p>fee is $185</p></main></body></html>`,
      NO_OPTS
    );
    const after = extractBlocks(
      `<html><body><main><p>fee is $205</p></main></body></html>`,
      NO_OPTS
    );
    expect(before.blocksHash).not.toBe(after.blocksHash);
  });

  it("kind matters in the hash: same text in <h2> vs <p> never collide", () => {
    const a = extractBlocks(`<html><body><main><h2>Important</h2></main></body></html>`, NO_OPTS);
    const b = extractBlocks(`<html><body><main><p>Important</p></main></body></html>`, NO_OPTS);
    expect(a.blocks[0].blockHash).not.toBe(b.blocks[0].blockHash);
  });

  it("computeBlocksHash on an empty list is stable", () => {
    expect(computeBlocksHash([])).toBe(computeBlocksHash([]));
  });

  describe("on real-shape fixtures", () => {
    it("produces stable blocks for the usembassy baseline fixture", () => {
      const fx = loadFixture("in.usembassy.gov", "2026-04-29-baseline");
      const r = extractBlocks(fx.html, NO_OPTS);
      expect(r.blocks.length).toBeGreaterThan(0);
      expect(r.blocks.some((b) => b.text.includes("$185"))).toBe(true);
      expect(r.blocks.every((b) => b.text.length > 0)).toBe(true);
    });

    it("identical blocksHash across the baseline and cosmetic-only fixtures (header/footer noise lives outside <main>)", () => {
      const a = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        NO_OPTS
      );
      const c = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-30-cosmetic").html,
        NO_OPTS
      );
      expect(a.blocksHash).toBe(c.blocksHash);
    });

    it("different blocksHash when the fee actually changes", () => {
      const a = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-29-baseline").html,
        NO_OPTS
      );
      const b = extractBlocks(
        loadFixture("in.usembassy.gov", "2026-04-30-fee-change").html,
        NO_OPTS
      );
      expect(a.blocksHash).not.toBe(b.blocksHash);
    });
  });
});
