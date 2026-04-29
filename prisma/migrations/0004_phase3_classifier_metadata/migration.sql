-- Phase 3: classifier grounding + cost metadata.
--
-- All additive: every column has a default or is nullable, so existing
-- Change rows stay valid (status = VALIDATED, evidenceQuotes = empty
-- array, prompt version = 'v1', everything else NULL).

BEGIN;

◇ injected env (0) from .env.local // tip: ◈ secrets for agents [www.dotenvx.com]
-- CreateEnum
CREATE TYPE "ClassifierStatus" AS ENUM ('VALIDATED', 'CLAMPED', 'UNGROUNDED', 'FALLBACK');

-- AlterTable
ALTER TABLE "Change" ADD COLUMN     "classifierCostUsd" DOUBLE PRECISION,
ADD COLUMN     "classifierModel" TEXT,
ADD COLUMN     "classifierPromptVersion" TEXT NOT NULL DEFAULT 'v1',
ADD COLUMN     "classifierRawSeverity" INTEGER,
ADD COLUMN     "classifierStatus" "ClassifierStatus" NOT NULL DEFAULT 'VALIDATED',
ADD COLUMN     "classifierTokensIn" INTEGER,
ADD COLUMN     "classifierTokensOut" INTEGER,
ADD COLUMN     "evidenceQuotes" TEXT[] DEFAULT ARRAY[]::TEXT[];


COMMIT;
