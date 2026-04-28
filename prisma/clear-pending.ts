import { db } from "../src/lib/db";

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.site.updateMany({
    where: { pendingDiff: { not: undefined } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { pendingDiff: null as any },
  });
  console.log(`Cleared pendingDiff on ${result.count} site(s).`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
