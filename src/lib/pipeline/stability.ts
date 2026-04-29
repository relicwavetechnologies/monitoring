import { db } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import {
  nextStabilityState,
  type PendingDiff,
  type StabilityVerdict,
} from "@/lib/pipeline/stability-logic";
import type { Prisma } from "@/generated/prisma/client";

const log = getLogger("pipeline.stability");

// Prisma's Json input wants an index signature; PendingDiff has typed fields.
// The cast is safe — every field of PendingDiff is JSON-compatible.
function asJson(p: PendingDiff): Prisma.InputJsonValue {
  return p as unknown as Prisma.InputJsonValue;
}

/**
 * Thin DB wrapper around `nextStabilityState`.
 *
 * Reads `Site.pendingDiff` + `Site.confirmAfterHours`, runs the pure decision,
 * and writes the new pending state back. Returns the high-level outcome the
 * caller cares about.
 */
export async function checkStability(
  siteId: string,
  newHash: string,
  diffText: string
): Promise<"confirmed" | "pending" | "reverted"> {
  const site = await db.site.findUnique({
    where: { id: siteId },
    select: { pendingDiff: true, confirmAfterHours: true },
  });

  const verdict: StabilityVerdict = nextStabilityState({
    pendingDiff: (site?.pendingDiff as PendingDiff | null) ?? null,
    newHash,
    newDiffText: diffText,
    now: new Date(),
    confirmAfterHours: site?.confirmAfterHours ?? 24,
  });

  switch (verdict.decision) {
    case "pending_first_sight":
    case "pending_reset":
      await db.site.update({ where: { id: siteId }, data: { pendingDiff: asJson(verdict.pending) } });
      log.info({ siteId, hash: newHash, decision: verdict.decision }, "stability pending");
      return "pending";

    case "pending_within_window":
      await db.site.update({ where: { id: siteId }, data: { pendingDiff: asJson(verdict.pending) } });
      log.info(
        { siteId, hash: newHash, etaHours: verdict.etaHours },
        "stability still inside confirm window"
      );
      return "pending";

    case "confirmed":
      await db.site.update({ where: { id: siteId }, data: { pendingDiff: undefined } });
      log.info({ siteId, hash: newHash }, "stability confirmed");
      return "confirmed";
  }
}
