#!/usr/bin/env bash
# VisaWatch nightly DB backup. Dumps the Postgres DB at $DATABASE_URL to
# a timestamped gzipped file under /opt/visa-monitoring/backups, keeps
# the last 14 days, and optionally uploads to S3-compatible storage if
# BACKUP_S3_BUCKET is set.
#
# Wire into the host's crontab:
#   30 3 * * *  /opt/visa-monitoring/scripts/backup-db.sh
#
# Restore: zcat <file>.sql.gz | psql "$DATABASE_URL"
set -euo pipefail

ENV_FILE="/opt/visa-monitoring/.env"
[[ -r "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[$(date -Is)] DATABASE_URL not set — aborting" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/visa-monitoring/backups}"
mkdir -p "$BACKUP_DIR"

TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)
OUT="$BACKUP_DIR/visawatch-${TS}.sql.gz"

echo "[$(date -Is)] dumping → $OUT"
pg_dump --format=plain --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$OUT"

# Verify the dump is non-trivially sized (sanity check).
SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
if (( SIZE < 1024 )); then
  echo "[$(date -Is)] backup suspiciously small ($SIZE bytes) — keeping for inspection but raising alarm" >&2
fi

# Prune anything older than 14 days.
find "$BACKUP_DIR" -name 'visawatch-*.sql.gz' -mtime +14 -delete || true

# Optional: upload to S3-compatible bucket if configured.
if [[ -n "${BACKUP_S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$OUT" "s3://${BACKUP_S3_BUCKET}/visawatch/" \
    --only-show-errors || echo "[$(date -Is)] S3 upload failed (non-fatal)" >&2
fi

echo "[$(date -Is)] backup complete ($SIZE bytes)"
