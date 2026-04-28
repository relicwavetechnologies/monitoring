import { crawlSite } from "../src/lib/pipeline/crawl";

const SITES = [
  { name: "ICA Singapore", url: "https://www.ica.gov.sg/", selector: ".content-area" },
  { name: "VFS UAE→SGP", url: "https://visa.vfsglobal.com/are/en/sgp/apply-visa", selector: ".main-content" },
  { name: "US Embassy Mumbai", url: "https://in.usembassy.gov/mumbai/", selector: "main" },
  { name: "VFS Individuals", url: "https://www.vfsglobal.com/en/individuals/index.html", selector: "main" },
];

async function main() {
  for (const site of SITES) {
    console.log(`\n── ${site.name} (${site.url})`);
    try {
      const result = await crawlSite(site.url, {
        contentSelector: site.selector,
        maxDepth: 1,
        maxPages: 5,
        pageTimeoutMs: 8000,
      });
      console.log(`   pages crawled:    ${result.pages.length}`);
      console.log(`   pages discovered: ${result.totalDiscovered}`);
      for (const p of result.pages) {
        console.log(`   [d${p.depth}] ${p.path} — status ${p.status} — ${p.text.length} chars`);
      }
    } catch (err) {
      console.log(`   ERROR: ${err}`);
    }
  }
}

main().catch(console.error);
