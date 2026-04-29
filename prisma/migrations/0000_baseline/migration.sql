-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateEnum
CREATE TYPE "RenderMode" AS ENUM ('STATIC', 'JS');
-- CreateEnum
CREATE TYPE "ChangeCategory" AS ENUM ('POLICY_CHANGE', 'FEE_CHANGE', 'APPOINTMENT', 'DOCUMENT_REQUIREMENT', 'NAVIGATION', 'COSMETIC', 'UNKNOWN');
-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "receivesAlerts" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);
-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "renderMode" "RenderMode" NOT NULL DEFAULT 'STATIC',
    "contentSelector" TEXT NOT NULL DEFAULT 'body',
    "stripPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pollIntervalMin" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "pendingDiff" JSONB,
    "aiAnalysis" TEXT,
    "aiAnalysisAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "htmlGz" BYTEA NOT NULL,
    "textGz" BYTEA NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fromSnapshotId" TEXT,
    "toSnapshotId" TEXT NOT NULL,
    "category" "ChangeCategory" NOT NULL DEFAULT 'UNKNOWN',
    "severity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "diffText" TEXT NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Change_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SerperHit" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedToSiteId" TEXT,
    CONSTRAINT "SerperHit_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
-- CreateIndex
CREATE INDEX "Snapshot_siteId_fetchedAt_idx" ON "Snapshot"("siteId", "fetchedAt" DESC);
-- CreateIndex
CREATE INDEX "Change_siteId_detectedAt_idx" ON "Change"("siteId", "detectedAt" DESC);
-- CreateIndex
CREATE INDEX "Change_severity_detectedAt_idx" ON "Change"("severity", "detectedAt" DESC);
-- CreateIndex
CREATE INDEX "SerperHit_seenAt_idx" ON "SerperHit"("seenAt" DESC);
-- CreateIndex
CREATE UNIQUE INDEX "SerperHit_query_url_key" ON "SerperHit"("query", "url");
-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
