import { db } from "@/lib/db";

interface PendingDiff {
  hash: string;
  diffText: string;
  firstSeenAt: string;
}

export async function checkStability(
  siteId: string,
  newHash: string,
  diffText: string
): Promise<"confirmed" | "pending" | "reverted"> {
  const site = await db.site.findUnique({ where: { id: siteId }, select: { pendingDiff: true } });

  const pending = site?.pendingDiff as PendingDiff | null;

  if (!pending) {
    // First time we see this hash — store as pending
    await db.site.update({
      where: { id: siteId },
      data: {
        pendingDiff: { hash: newHash, diffText, firstSeenAt: new Date().toISOString() },
      },
    });
    return "pending";
  }

  if (pending.hash === newHash) {
    // Same hash on second poll — confirmed, clear pending
    await db.site.update({ where: { id: siteId }, data: { pendingDiff: undefined } });
    return "confirmed";
  }

  // Hash changed again — new transient diff, restart window
  await db.site.update({
    where: { id: siteId },
    data: {
      pendingDiff: { hash: newHash, diffText, firstSeenAt: new Date().toISOString() },
    },
  });
  return "pending";
}
