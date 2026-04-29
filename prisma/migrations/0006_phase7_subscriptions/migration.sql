-- Phase 7: per-user Subscription model + per-Change mute/ack + per-URL
-- mutePatterns. Backfills one Subscription per (User where receivesAlerts
-- = true, active Site) so existing alert behaviour is preserved.

BEGIN;

-- ── 1. Enum + new table ─────────────────────────────────────────────────────
CREATE TYPE "AlertChannel" AS ENUM ('EMAIL', 'SLACK', 'WEBHOOK');

CREATE TABLE "Subscription" (
    "id"             TEXT          NOT NULL,
    "userId"         TEXT          NOT NULL,
    "siteId"         TEXT,
    "monitoredUrlId" TEXT,
    "channel"        "AlertChannel" NOT NULL DEFAULT 'EMAIL',
    "minSeverity"    INTEGER,
    "webhookUrl"     TEXT,
    "paused"         BOOLEAN       NOT NULL DEFAULT FALSE,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_unique"
  ON "Subscription"("userId", "siteId", "monitoredUrlId", "channel");
CREATE INDEX "Subscription_siteId_paused_idx"
  ON "Subscription"("siteId", "paused");
CREATE INDEX "Subscription_monitoredUrlId_paused_idx"
  ON "Subscription"("monitoredUrlId", "paused");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Per-Change mute / acknowledge ────────────────────────────────────────
ALTER TABLE "Change"
  ADD COLUMN "acknowledgedAt"   TIMESTAMP(3),
  ADD COLUMN "acknowledgedById" TEXT,
  ADD COLUMN "muted"            BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. Per-MonitoredUrl mute patterns ───────────────────────────────────────
ALTER TABLE "MonitoredUrl"
  ADD COLUMN "mutePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── 4. Backfill: one Subscription per (alerts-on user, active site) ─────────
-- IDs deterministic so re-running is idempotent.
INSERT INTO "Subscription" ("id", "userId", "siteId", "channel", "createdAt", "updatedAt")
SELECT
    'sub_' || u."id" || '_' || s."id" AS "id",
    u."id"                            AS "userId",
    s."id"                            AS "siteId",
    'EMAIL'::"AlertChannel"           AS "channel",
    NOW()                             AS "createdAt",
    NOW()                             AS "updatedAt"
FROM "User" u
CROSS JOIN "Site" s
WHERE u."receivesAlerts" = TRUE
  AND s."isActive" = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" sub
    WHERE sub."userId" = u."id" AND sub."siteId" = s."id" AND sub."channel" = 'EMAIL'
  );

COMMIT;
