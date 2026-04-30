/**
 * Smoke test the Phase 8 bootstrap crawler against the gov sites in the DB.
 * Run with:
 *
 *   pnpm exec tsx scripts/test-bootstrap.mts <root-url>
 *
 * Prints the topic cards as JSON. Does not write to the database — purely
 * exercises the crawl + LLM-classification pipeline end-to-end.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { bootstrapCrawl } from "@/lib/adapters/bootstrap-crawl";

const url = process.argv[2];
if (!url) {
  console.error("usage: tsx scripts/test-bootstrap.mts <root-url>");
  process.exit(1);
}

(async () => {
  console.log(`bootstrapping ${url}…\n`);
  const t0 = Date.now();
  const result = await bootstrapCrawl(url, { maxPages: 12, maxDepth: 1 });
  const ms = Date.now() - t0;

  console.log(`fetchModeUsed: ${result.fetchModeUsed}`);
  console.log(`pages: ${result.pages.length} (${result.totalDiscovered} discovered)`);
  console.log(`errors: ${result.errors.length}`);
  console.log(`elapsed: ${(ms / 1000).toFixed(1)}s\n`);

  for (const p of result.pages) {
    const cat = p.card?.category ?? (p.skipped ? "SKIP" : "—");
    const title = p.card?.title ?? p.title ?? p.path;
    console.log(`[${cat.padEnd(13)}] ${p.path}`);
    console.log(`               ${title}`);
    if (p.card?.summary) {
      console.log(`               ${p.card.summary.slice(0, 140)}`);
    }
    if (p.card?.importantFields?.length) {
      console.log(`               fields: ${p.card.importantFields.join(", ")}`);
    }
    console.log("");
  }

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of result.errors) {
      console.log(`  ${e.reason} — ${e.url}`);
    }
  }
})().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
