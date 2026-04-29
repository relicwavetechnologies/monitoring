/**
 * Capture an HTML fixture from a live URL using the same fetcher the runtime uses.
 *
 *   pnpm tsx scripts/capture-fixture.ts <url> [--label <suffix>] [--mode static|js]
 *
 * Writes to: tests/fixtures/sites/<host>/<YYYY-MM-DD>[-<label>].html
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fetchSite } from "@/lib/pipeline/fetch";
import type { RenderMode } from "@/generated/prisma/enums";

interface Args {
  url: string;
  label?: string;
  mode: RenderMode;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let label: string | undefined;
  let mode: RenderMode = "STATIC";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--label" || arg === "-l") {
      label = argv[++i];
    } else if (arg === "--mode" || arg === "-m") {
      const next = argv[++i]?.toUpperCase();
      if (next === "JS") mode = "JS";
      else if (next === "STATIC") mode = "STATIC";
      else throw new Error(`Unknown mode: ${argv[i]}. Use 'static' or 'js'.`);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error(
      "Usage: pnpm tsx scripts/capture-fixture.ts <url> [--label <suffix>] [--mode static|js]"
    );
  }
  return { url: positional[0], label, mode };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const u = new URL(args.url);
  const host = u.host;
  const today = new Date().toISOString().slice(0, 10);
  const filename = args.label ? `${today}-${args.label}.html` : `${today}.html`;

  const dir = path.join("tests", "fixtures", "sites", host);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, filename);

  if (existsSync(outPath)) {
    throw new Error(
      `${outPath} already exists. Pick a different --label or delete the existing fixture first.`
    );
  }

  process.stderr.write(`fetching ${args.url} (mode=${args.mode})…\n`);
  const result = await fetchSite(args.url, args.mode);

  writeFileSync(outPath, result.html, "utf8");
  process.stderr.write(
    `wrote ${outPath} (${result.html.length} chars, http ${result.status})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`capture failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
