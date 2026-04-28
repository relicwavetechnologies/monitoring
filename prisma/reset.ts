import { db } from "../src/lib/db";

async function main() {
  console.log("Deleting all changes…");
  const changes = await db.change.deleteMany();
  console.log(`  Deleted ${changes.count} change records`);

  console.log("Deleting all snapshots…");
  const snapshots = await db.snapshot.deleteMany();
  console.log(`  Deleted ${snapshots.count} snapshots`);

  console.log("Deleting all sites…");
  const sites = await db.site.deleteMany();
  console.log(`  Deleted ${sites.count} sites`);

  console.log("Done — database is clean.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
