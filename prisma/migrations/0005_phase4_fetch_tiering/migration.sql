-- Phase 4: per-URL fetch tiering with auto-escalation.
--
-- Adds FetchMode and FailureKind enums and six new MonitoredUrl columns.
-- All defaults are safe; existing rows get fetchMode = STATIC initially,
-- then we backfill PLAYWRIGHT for any URL whose legacy renderMode was JS
-- so the runtime behaviour matches what was happening before this phase.

BEGIN;

-- ── 1. Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "FetchMode" AS ENUM ('STATIC', 'PLAYWRIGHT', 'STEALTH', 'EXTERNAL');
CREATE TYPE "FailureKind" AS ENUM ('NETWORK', 'BLOCKED', 'TIMEOUT', 'PARSE', 'OTHER');

-- ── 2. New columns on MonitoredUrl (all default-safe) ───────────────────────
ALTER TABLE "MonitoredUrl"
  ADD COLUMN "fetchMode"             "FetchMode"   NOT NULL DEFAULT 'STATIC',
  ADD COLUMN "consecutiveFailures"   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN "lastFailureAt"         TIMESTAMP(3),
  ADD COLUMN "lastFailureKind"       "FailureKind",
  ADD COLUMN "autoEscalate"          BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN "escalateAfterFailures" INTEGER       NOT NULL DEFAULT 3;

-- ── 3. Backfill fetchMode from the legacy renderMode field ──────────────────
-- A site that previously had renderMode = JS needs PLAYWRIGHT to keep
-- working; STATIC stays STATIC. Existing JS sites that were getting
-- blocked under PLAYWRIGHT will auto-escalate to STEALTH after 3
-- consecutive failures once Phase 4's runtime ships.
UPDATE "MonitoredUrl" SET "fetchMode" = 'PLAYWRIGHT' WHERE "renderMode" = 'JS';

-- ── 4. Lookup index for the auto-escalation sweep ───────────────────────────
CREATE INDEX "MonitoredUrl_fetchMode_consecutiveFailures_idx"
  ON "MonitoredUrl"("fetchMode", "consecutiveFailures");

COMMIT;
