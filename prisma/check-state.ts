import { db } from "../src/lib/db";

async function main() {
  const sites = await db.site.findMany({
    include: {
      _count: { select: { snapshots: true, changes: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n${sites.length} site(s) in DB:\n`);
  for (const s of sites) {
    console.log(`  ${s.name}`);
    console.log(`    url:       ${s.url}`);
    console.log(`    snapshots: ${s._count.snapshots}`);
    console.log(`    changes:   ${s._count.changes}`);
    console.log(`    lastCheck: ${s.lastCheckedAt ?? "never"}`);
    console.log(`    pendingDiff: ${s.pendingDiff ? "YES" : "none"}`);
    console.log();
  }

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
