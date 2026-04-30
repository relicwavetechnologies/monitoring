-- Phase 8: per-MonitoredUrl topic cards (LLM-generated descriptions of
-- what each sub-page covers), Snapshot.visualHash + Snapshot.embedding
-- columns for the multi-modal diff fallback, and the CAMOUFOX fetch tier
-- between STEALTH and EXTERNAL.

BEGIN;

-- ── 1. CAMOUFOX added to FetchMode enum ─────────────────────────────────────
-- Postgres requires ALTER TYPE … ADD VALUE in its own transaction in older
-- versions, but PG ≥ 12 allows it inside an open block when the type was
-- created in this session OR when no concurrent reads use the new value.
-- Our migration runner runs each migration in its own transaction, so this
-- is safe.
ALTER TYPE "FetchMode" ADD VALUE IF NOT EXISTS 'CAMOUFOX' AFTER 'STEALTH';

-- ── 2. MonitoredUrl: topic card columns ─────────────────────────────────────
ALTER TABLE "MonitoredUrl"
  ADD COLUMN IF NOT EXISTS "topicCard"   JSONB,
  ADD COLUMN IF NOT EXISTS "topicCardAt" TIMESTAMP(3);

-- ── 3. Snapshot: multi-modal diff columns ───────────────────────────────────
ALTER TABLE "Snapshot"
  ADD COLUMN IF NOT EXISTS "visualHash" TEXT,
  ADD COLUMN IF NOT EXISTS "embedding"  BYTEA;

COMMIT;
