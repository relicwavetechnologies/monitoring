-- Phase 1: per-site thresholds, content-hash idempotency, email-status enum.
--
-- Order is important: new columns are added permissively first, backfilled
-- from existing data, then constraints are tightened. Run inside a single
-- transaction so a partial failure rolls back cleanly.

BEGIN;

-- ── 1. Site: per-site tunable thresholds (all defaults; no backfill needed) ──
ALTER TABLE "Site"
  ADD COLUMN "minDiffChars"        INTEGER          NOT NULL DEFAULT 40,
  ADD COLUMN "severityThreshold"   INTEGER          NOT NULL DEFAULT 3,
  ADD COLUMN "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  ADD COLUMN "confirmAfterHours"   INTEGER          NOT NULL DEFAULT 24,
  ADD COLUMN "maxCrawlDepth"       INTEGER          NOT NULL DEFAULT 2,
  ADD COLUMN "maxCrawlPages"       INTEGER          NOT NULL DEFAULT 20;

-- ── 2. EmailStatus enum + new Change columns (all permissive at first) ──────
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "Change"
  ADD COLUMN "emailStatus"        "EmailStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "emailAttempts"      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN "lastEmailError"     TEXT,
  ADD COLUMN "lastEmailAttemptAt" TIMESTAMP(3),
  ADD COLUMN "fromContentHash"    TEXT,
  ADD COLUMN "toContentHash"      TEXT;

-- ── 3. Backfill emailStatus from the legacy emailSent boolean ───────────────
UPDATE "Change"
   SET "emailStatus" = CASE
                         WHEN "emailSent" = TRUE THEN 'SENT'::"EmailStatus"
                         ELSE                         'SKIPPED'::"EmailStatus"
                       END;

-- ── 4. Backfill content hashes from referenced snapshots ────────────────────
UPDATE "Change" c
   SET "toContentHash" = s."contentHash"
  FROM "Snapshot" s
 WHERE s."id" = c."toSnapshotId";

UPDATE "Change" c
   SET "fromContentHash" = s."contentHash"
  FROM "Snapshot" s
 WHERE c."fromSnapshotId" IS NOT NULL
   AND s."id" = c."fromSnapshotId";

-- Defensive: any row whose snapshot is gone (cascade-deleted) gets a synthetic
-- value so the NOT NULL constraint can be applied. Such rows are degenerate
-- already (the snapshot they pointed to no longer exists).
UPDATE "Change"
   SET "toContentHash" = 'orphan:' || "id"
 WHERE "toContentHash" IS NULL;

-- ── 5. Tighten constraints now that the data is populated ───────────────────
ALTER TABLE "Change" ALTER COLUMN "toContentHash" SET NOT NULL;
ALTER TABLE "Change" DROP COLUMN "emailSent";

-- ── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX "Change_emailStatus_lastEmailAttemptAt_idx"
  ON "Change"("emailStatus", "lastEmailAttemptAt");

-- NULLS NOT DISTINCT is required so that two changes from a NULL prior hash
-- (i.e. two baseline-relative changes) are still deduped. Postgres 15+ only.
CREATE UNIQUE INDEX "Change_siteId_fromContentHash_toContentHash_key"
  ON "Change"("siteId", "fromContentHash", "toContentHash") NULLS NOT DISTINCT;

COMMIT;
