/**
 * Calibration runner. Reads tests/calibration/cases.yaml, runs each case
 * through the full classify pipeline (rules → LLM → clamps → grounding),
 * and prints a confusion matrix + precision/recall.
 *
 * Usage:
 *   pnpm calibrate                       # run all cases
 *   pnpm calibrate --filter fee          # only cases whose id matches /fee/
 *   pnpm calibrate --json                # machine-readable output
 *
 * Cost: every case costs one or two LLM calls. The default 5 cases come to
 * roughly $0.001 on Gemini-3 Flash Lite. Be mindful when the suite grows.
 *
 * The runner does NOT touch the DB — it calls `classifyChange` directly
 * with the case's added/removed lines.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { classifyChange } from "@/lib/pipeline/classify";

interface Case {
  id: string;
  site_name: string;
  site_url: string;
  added_lines: string[];
  removed_lines: string[];
  expected_categories: string[];
  severity_min: number;
  severity_max: number;
  must_be_grounded: boolean;
}

interface Args {
  filter: RegExp | null;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  let filter: RegExp | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--filter" && argv[i + 1]) {
      filter = new RegExp(argv[++i], "i");
    } else if (argv[i] === "--json") {
      json = true;
    }
  }
  return { filter, json };
}

interface CaseResult {
  id: string;
  status: "PASS" | "FAIL";
  reasons: string[];
  expected: { categories: string[]; severityMin: number; severityMax: number };
  actual: {
    category: string;
    severity: number;
    confidence: number;
    classifierStatus: string;
    rawSeverity: number;
    model: string;
    quoteCount: number;
    costUsd: number;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const yamlPath = path.join(__dirname, "cases.yaml");
  const doc = parse(readFileSync(yamlPath, "utf8")) as { cases: Case[] };
  const cases = doc.cases.filter((c) => !args.filter || args.filter.test(c.id));

  const results: CaseResult[] = [];
  let totalCost = 0;

  for (const c of cases) {
    if (!args.json) process.stderr.write(`▷ ${c.id}\n`);
    const diffText = [
      "=== ADDED ===",
      c.added_lines.join("\n"),
      "",
      "=== REMOVED ===",
      c.removed_lines.join("\n"),
    ].join("\n");

    const result = await classifyChange({
      siteName: c.site_name,
      siteUrl: c.site_url,
      addedLines: c.added_lines,
      removedLines: c.removed_lines,
      diffText,
    });

    totalCost += result.costUsd;

    const reasons: string[] = [];
    if (!c.expected_categories.includes(result.category)) {
      reasons.push(
        `category ${result.category} not in expected ${c.expected_categories.join(",")}`
      );
    }
    if (result.severity < c.severity_min || result.severity > c.severity_max) {
      reasons.push(
        `severity ${result.severity} outside expected [${c.severity_min},${c.severity_max}]`
      );
    }
    if (c.must_be_grounded && result.evidenceQuotes.length === 0) {
      reasons.push("must_be_grounded but no quotes were verified");
    }

    results.push({
      id: c.id,
      status: reasons.length === 0 ? "PASS" : "FAIL",
      reasons,
      expected: {
        categories: c.expected_categories,
        severityMin: c.severity_min,
        severityMax: c.severity_max,
      },
      actual: {
        category: result.category,
        severity: result.severity,
        confidence: result.confidence,
        classifierStatus: result.status,
        rawSeverity: result.rawSeverity,
        model: result.model,
        quoteCount: result.evidenceQuotes.length,
        costUsd: result.costUsd,
      },
    });
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.length - passed;

  if (args.json) {
    process.stdout.write(
      JSON.stringify({ passed, failed, totalCostUsd: totalCost, results }, null, 2) + "\n"
    );
  } else {
    process.stderr.write("\n");
    for (const r of results) {
      const tag = r.status === "PASS" ? "✓" : "✗";
      process.stderr.write(
        `${tag} ${r.id}\n` +
          `   actual:   ${r.actual.category} sev=${r.actual.severity} conf=${r.actual.confidence.toFixed(2)} status=${r.actual.classifierStatus} model=${r.actual.model}\n` +
          `   expected: ${r.expected.categories.join("|")} sev=[${r.expected.severityMin},${r.expected.severityMax}]\n`
      );
      for (const reason of r.reasons) process.stderr.write(`   - ${reason}\n`);
    }
    process.stderr.write(
      `\n${passed}/${results.length} passing — total cost $${totalCost.toFixed(4)}\n`
    );
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`calibration runner crashed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(2);
});
