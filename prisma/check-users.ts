import { db } from "../src/lib/db";

async function main() {
  const users = await db.user.findMany({
    select: { email: true, receivesAlerts: true, name: true },
  });
  console.log("Users in DB:");
  console.log(JSON.stringify(users, null, 2));

  const recipients = users.filter((u) => u.receivesAlerts && u.email);
  console.log(`\n${recipients.length} user(s) will receive alert emails.`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
