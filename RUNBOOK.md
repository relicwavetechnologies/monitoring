# VisaWatch — operations runbook

Single source of truth for day-2 operations: how to deploy, how to
recover from common failure modes, where the secrets live, what the
healthchecks mean.

## At a glance

| Surface | Where |
|---|---|
| App URL (prod) | `http://<vm-ip>:9000` (Caddy) |
| Healthcheck | `GET /api/healthcheck` — public, returns 200/503 |
| Admin metrics | `GET /api/admin/metrics` (auth-gated) |
| Admin queue | `GET /api/admin/queue` (auth-gated) |
| DB | Neon (`DATABASE_URL` in `.env`) |
| Queue | pg-boss in `pgboss` schema in the same DB |
| Logs | `docker compose logs -f app` on the VM |
| Backups | `/opt/visa-monitoring/backups/visawatch-*.sql.gz` (14-day retention) |

## Required env vars (`.env` on the VM)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Neon TCP URL works) |
| `CRON_SECRET` | Bearer for `/api/cron/*` and the host crontab wrapper |
| `RESEND_API_KEY`, `RESEND_FROM` | Email delivery |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | LLM gateway (defaults to the configured Render gateway) |
| `OPENAI_MODEL_FAST`, `OPENAI_MODEL_BEST` | Override classifier tiers (optional) |
| `ALLOWED_EMAILS` | Comma-separated whitelist for sign-up gate |
| `NEXT_PUBLIC_BASE_URL` | Used in Slack/webhook payload links |
| `SCRAPER_API_URL`, `SCRAPER_API_KEY` | Optional Phase 4 EXTERNAL fetcher |
| `BACKUP_S3_BUCKET` | Optional S3 upload target for nightly backups |
| `QUEUE_DISABLED` | Set to `"true"` to skip queue boot (debugging) |

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`:

1. Builds + pushes the image to GHCR.
2. Runs `prisma migrate deploy` against the prod DB.
3. SSHes to the VM, pulls the new image, restarts via `docker compose up -d`.

**One-time prod cutover** (Phase 1, already done): `pnpm exec prisma migrate resolve --applied 0000_baseline` against the prod DB. Without this the first migration-aware deploy fails at the migrate step.

## Crontab (host VM)

```cron
0 9   * * *  /opt/visa-monitoring/scripts/cron-call.sh tick         # legacy fallback (pg-boss schedules its own)
0 8   * * *  /opt/visa-monitoring/scripts/cron-call.sh serper       # Google news search
30 3  * * *  /opt/visa-monitoring/scripts/backup-db.sh              # nightly DB backup
```

The Phase 5 pg-boss-internal scheduler runs `tick.scan` every 5 minutes and `email.sweep` every 15. The host crontab `tick` line above is now optional belt-and-braces.

## Restore from backup

```bash
# 1. Pick the dump.
ls -lh /opt/visa-monitoring/backups/

# 2. Decompress and apply against a fresh DB or branch.
zcat /opt/visa-monitoring/backups/visawatch-2026-04-29T03-30-00Z.sql.gz \
  | psql "$DATABASE_URL"
```

For a destructive restore in-place: stop the app first (`docker compose stop app`), drop and recreate the public schema, apply the dump, then `prisma migrate deploy` to ensure the schema is current.

## Common failure modes

### "Deploy fails at the migrate step"

Symptom: `migrate deploy` errors with "table already exists" or similar.

Likely cause: you skipped the one-time `migrate resolve --applied 0000_baseline`.

Fix: SSH to a place that can reach the prod DB, run that command, retry the deploy via `gh run rerun <id>`.

### "All polls returning BLOCKED"

Symptom: every URL's `lastFailureKind = 'BLOCKED'` after a fresh deploy.

Likely cause: the auto-escalation has hit the EXTERNAL tier, but `SCRAPER_API_URL` isn't configured.

Fix: either configure `SCRAPER_API_URL` + `SCRAPER_API_KEY`, or `UPDATE "MonitoredUrl" SET "fetchMode" = 'STEALTH', "consecutiveFailures" = 0` and run `npx patchright install chromium` on the VM if you haven't.

### "Worker won't start"

Symptom: server boots but pg-boss logs `pg-boss internal error` repeatedly.

Likely cause: DB unreachable, `pgboss` schema missing privileges, or wrong `DATABASE_URL`.

Fix:
```bash
# In the app container:
node -e "console.log(process.env.DATABASE_URL)"
# Verify the URL works:
psql "$DATABASE_URL" -c "select 1"
# Ensure the role can create schemas (pg-boss needs DDL on first start):
psql "$DATABASE_URL" -c "select has_database_privilege(current_user, current_database(), 'CREATE')"
```

If the worker is genuinely jammed: `QUEUE_DISABLED=true docker compose up -d app` to start the web without the queue, fix the underlying issue, then redeploy normally.

### "Queue stuck — jobs accumulating, none completing"

Symptom: `/api/admin/queue` shows `queuedCount` rising, `activeCount` low.

Diagnose:
```bash
# Inside the container or via psql:
psql "$DATABASE_URL" -c "select name, count(*) from pgboss.job where state = 'created' group by name"
psql "$DATABASE_URL" -c "select name, count(*) from pgboss.job where state = 'failed' group by name"
```

Fix: most stuck-queue cases are an unhandled exception in a handler. Check `docker compose logs app | grep ERROR | tail`. Resolve the underlying issue and restart the container — pg-boss picks up where it left off.

### "Resend API key revoked"

Symptom: `email.send` jobs failing with 401.

Fix: rotate the key in Resend, update `RESEND_API_KEY` in `/opt/visa-monitoring/.env`, restart the container. The `email.sweep` job will retry the FAILED rows automatically once the key is valid.

### "VFS suddenly stops working again"

Symptom: VFS URLs that were healthy on STEALTH are now BLOCKED.

This means Cloudflare shipped a new defense Patchright doesn't yet defeat. Two paths:
1. Bump `patchright` to the latest version on the VM (`pnpm up patchright && npx patchright install chromium`).
2. Configure the EXTERNAL tier (Browserless / Scrapfly / ZenRows). Set `SCRAPER_API_URL` + `SCRAPER_API_KEY`, then `UPDATE "MonitoredUrl" SET "fetchMode" = 'EXTERNAL', "consecutiveFailures" = 0 WHERE url LIKE '%vfsglobal%'`.

## Secret rotation

| Secret | Where it lives | Rotation procedure |
|---|---|---|
| `CRON_SECRET` | VM `.env`, GitHub Actions secret | Generate new, write to both, restart container |
| `RESEND_API_KEY` | VM `.env`, GitHub Actions secret (build-time only) | Rotate in Resend dashboard, update both, restart |
| `OPENAI_API_KEY` | VM `.env` | Rotate at provider, update VM `.env`, restart |
| `DATABASE_URL` | VM `.env`, GitHub Actions secret | Rotate password in Neon, update both, redeploy |
| `SSH_KEY` | GitHub Actions secret | Generate new keypair, install pubkey on VM, replace secret |

Never rotate a secret without verifying both halves first; an out-of-sync `DATABASE_URL` will break the next deploy.

## Quick verification after deploy

```bash
# 1. Healthcheck.
curl -s https://<host>/api/healthcheck | jq

# 2. Latest commit reflected.
docker compose ps
docker image ls | head -3

# 3. Queue is alive.
curl -sH "Cookie: <session>" https://<host>/api/admin/queue | jq

# 4. Migrations applied.
psql "$DATABASE_URL" -c "select * from \"_prisma_migrations\" order by finished_at desc limit 5"
```

If healthcheck is 200, a fresh `Snapshot` row appears within `pollIntervalMin` minutes for at least one MonitoredUrl, and `/api/admin/metrics` shows non-zero counters within 30 minutes — the deploy is good.
