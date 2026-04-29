-- Phase 2a: block-level snapshots for reorder-resilient diffing.
--
-- Adds a new SnapshotBlock table and two new columns on Snapshot.
-- The new columns are nullable / defaulted, so legacy rows stay valid.
-- The runtime prefers the new path (blocksHash + SnapshotBlock.blockHash
-- set diff) and falls back to the legacy contentHash + text-line diff
-- when either side of the comparison predates this migration.

BEGIN;

◇ injected env (0) from .env.local // tip: ⌘ custom filepath { path: '/custom/path/.env' }
-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "blocksHash" TEXT,
ADD COLUMN     "extractStrategy" TEXT NOT NULL DEFAULT 'SELECTOR';

-- CreateTable
CREATE TABLE "SnapshotBlock" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "blockHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "SnapshotBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SnapshotBlock_snapshotId_idx_idx" ON "SnapshotBlock"("snapshotId", "idx");

-- CreateIndex
CREATE INDEX "SnapshotBlock_snapshotId_blockHash_idx" ON "SnapshotBlock"("snapshotId", "blockHash");

-- CreateIndex
CREATE INDEX "Snapshot_siteId_blocksHash_idx" ON "Snapshot"("siteId", "blocksHash");

-- AddForeignKey
ALTER TABLE "SnapshotBlock" ADD CONSTRAINT "SnapshotBlock_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
