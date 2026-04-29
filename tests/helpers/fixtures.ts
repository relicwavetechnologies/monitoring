import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const FIXTURE_ROOT = path.join(__dirname, "..", "fixtures", "sites");

export interface Fixture {
  host: string;
  date: string;
  html: string;
  path: string;
}

export function loadFixture(host: string, date: string): Fixture {
  const filePath = path.join(FIXTURE_ROOT, host, `${date}.html`);
  if (!existsSync(filePath)) {
    throw new Error(
      `Fixture not found: ${host}/${date}.html. ` +
        `Capture one with: pnpm tsx scripts/capture-fixture.ts <url> --label ${date}`
    );
  }
  return {
    host,
    date,
    html: readFileSync(filePath, "utf8"),
    path: filePath,
  };
}

export function listFixtures(host: string): string[] {
  const hostDir = path.join(FIXTURE_ROOT, host);
  if (!existsSync(hostDir)) return [];
  return readdirSync(hostDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""))
    .sort();
}

export function listFixtureHosts(): string[] {
  if (!existsSync(FIXTURE_ROOT)) return [];
  return readdirSync(FIXTURE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
