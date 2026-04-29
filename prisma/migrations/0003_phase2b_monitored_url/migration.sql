-- Phase 2b: split Site into Site + MonitoredUrl.
--
-- A Site is the logical container ("US Embassy Mumbai"); a MonitoredUrl is
-- the specific URL we actually poll. Per-URL config (selector, strip
-- patterns, render mode, paused, pendingDiff) moves here. Per-site policy
-- (severity thresholds, confirm window, etc.) stays on Site.
--
-- Existing data is preserved: each Site gets exactly one auto-generated
-- MonitoredUrl with values copied from the Site, and every existing
-- Snapshot / Change is re-pointed at it. Snapshot.siteId and Change.siteId
-- are kept as denorms for fast site-wide queries.

BEGIN;

-- ── 1. Create the MonitoredUrl table ────────────────────────────────────────
CREATE TABLE "MonitoredUrl" (
    "id"              TEXT          NOT NULL,
    "siteId"          TEXT          NOT NULL,
    "url"             TEXT          NOT NULL,
    "contentSelector" TEXT          NOT NULL DEFAULT 'body',
    "stripPatterns"   TEXT[]                 DEFAULT ARRAY[]::TEXT[],
    "renderMode"      "RenderMode"  NOT NULL DEFAULT 'STATIC',
    "paused"          BOOLEAN       NOT NULL DEFAULT false,
    "lastCheckedAt"   TIMESTAMP(3),
    "pendingDiff"     JSONB,
    "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitoredUrl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonitoredUrl_siteId_url_key"
  ON "MonitoredUrl"("siteId", "url");

CREATE INDEX "MonitoredUrl_siteId_paused_lastCheckedAt_idx"
  ON "MonitoredUrl"("siteId", "paused", "lastCheckedAt");

ALTER TABLE "MonitoredUrl"
  ADD CONSTRAINT "MonitoredUrl_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Backfill: one MonitoredUrl per Site, config copied from Site ─────────
-- IDs are deterministic ("mu_<siteId>") so re-running the backfill on a
-- partially-applied database is idempotent.
INSERT INTO "MonitoredUrl" (
    "id", "siteId", "url",
    "contentSelector", "stripPatterns", "renderMode",
    "paused", "lastCheckedAt", "pendingDiff",
    "createdAt", "updatedAt"
)
SELECT
    'mu_' || s."id"      AS "id",
    s."id"               AS "siteId",
    s."url"              AS "url",
    s."contentSelector"  AS "contentSelector",
    s."stripPatterns"    AS "stripPatterns",
    s."renderMode"       AS "renderMode",
    NOT s."isActive"     AS "paused",
    s."lastCheckedAt"    AS "lastCheckedAt",
    s."pendingDiff"      AS "pendingDiff",
    s."createdAt"        AS "createdAt",
    NOW()                AS "updatedAt"
FROM "Site" s
WHERE NOT EXISTS (
    SELECT 1 FROM "MonitoredUrl" mu WHERE mu."siteId" = s."id"
);

-- ── 3. Add monitoredUrlId columns to Snapshot / Change (nullable for now) ───
ALTER TABLE "Snapshot" ADD COLUMN "monitoredUrlId" TEXT;
ALTER TABLE "Change"   ADD COLUMN "monitoredUrlId" TEXT;

-- ── 4. Backfill Snapshot.monitoredUrlId from the just-created MonitoredUrls ─
UPDATE "Snapshot" sn
   SET "monitoredUrlId" = mu."id"
  FROM "MonitoredUrl" mu
 WHERE mu."siteId" = sn."siteId"
   AND sn."monitoredUrlId" IS NULL;

UPDATE "Change" c
   SET "monitoredUrlId" = mu."id"
  FROM "MonitoredUrl" mu
 WHERE mu."siteId" = c."siteId"
   AND c."monitoredUrlId" IS NULL;

-- ── 5. Tighten constraints + foreign keys now that data is populated ────────
ALTER TABLE "Snapshot" ALTER COLUMN "monitoredUrlId" SET NOT NULL;
ALTER TABLE "Change"   ALTER COLUMN "monitoredUrlId" SET NOT NULL;

ALTER TABLE "Snapshot"
  ADD CONSTRAINT "Snapshot_monitoredUrlId_fkey"
  FOREIGN KEY ("monitoredUrlId") REFERENCES "MonitoredUrl"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Change"
  ADD CONSTRAINT "Change_monitoredUrlId_fkey"
  FOREIGN KEY ("monitoredUrlId") REFERENCES "MonitoredUrl"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. Replace the per-Site idempotency key with a per-MonitoredUrl one ─────
-- Two URLs on the same Site can independently produce a change with the
-- same hash transition (e.g. both pages display the same fee number),
-- so the unique scope tightens from siteId to monitoredUrlId.
DROP INDEX IF EXISTS "Change_siteId_fromContentHash_toContentHash_key";

CREATE UNIQUE INDEX "Change_monitoredUrlId_fromContentHash_toContentHash_key"
  ON "Change"("monitoredUrlId", "fromContentHash", "toContentHash")
  NULLS NOT DISTINCT;

-- ── 7. Per-URL lookup indexes ───────────────────────────────────────────────
CREATE INDEX "Snapshot_monitoredUrlId_fetchedAt_idx"
  ON "Snapshot"("monitoredUrlId", "fetchedAt" DESC);

CREATE INDEX "Snapshot_monitoredUrlId_blocksHash_idx"
  ON "Snapshot"("monitoredUrlId", "blocksHash");

CREATE INDEX "Change_monitoredUrlId_detectedAt_idx"
  ON "Change"("monitoredUrlId", "detectedAt" DESC);

COMMIT;
