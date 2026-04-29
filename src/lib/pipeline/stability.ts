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
 * Phase 2b: state lives on the MonitoredUrl, not on the Site, so two URLs on
 * the same site each carry their own pending-window. The confirm-window
 * value still comes from the parent Site.
 */
export async function checkStability(
  monitoredUrlId: string,
  newHash: string,
  diffText: string
): Promise<"confirmed" | "pending" | "reverted"> {
  const url = await db.monitoredUrl.findUnique({
    where: { id: monitoredUrlId },
    select: { pendingDiff: true, site: { select: { confirmAfterHours: true } } },
  });

  const verdict: StabilityVerdict = nextStabilityState({
    pendingDiff: (url?.pendingDiff as PendingDiff | null) ?? null,
    newHash,
    newDiffText: diffText,
    now: new Date(),
    confirmAfterHours: url?.site?.confirmAfterHours ?? 24,
  });

  switch (verdict.decision) {
    case "pending_first_sight":
    case "pending_reset":
      await db.monitoredUrl.update({
        where: { id: monitoredUrlId },
        data: { pendingDiff: asJson(verdict.pending) },
      });
      log.info({ monitoredUrlId, hash: newHash, decision: verdict.decision }, "stability pending");
      return "pending";

    case "pending_within_window":
      await db.monitoredUrl.update({
        where: { id: monitoredUrlId },
        data: { pendingDiff: asJson(verdict.pending) },
      });
      log.info(
        { monitoredUrlId, hash: newHash, etaHours: verdict.etaHours },
        "stability still inside confirm window"
      );
      return "pending";

    case "confirmed":
      await db.monitoredUrl.update({
        where: { id: monitoredUrlId },
        data: { pendingDiff: undefined },
      });
      log.info({ monitoredUrlId, hash: newHash }, "stability confirmed");
      return "confirmed";
  }
}
