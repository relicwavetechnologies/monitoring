#!/usr/bin/env bash
# Wrapper used by host crontab. Reads CRON_SECRET from the deploy .env and
# hits the in-cluster cron endpoint via Caddy on localhost.
#
# Usage:  cron-call.sh <endpoint>      # endpoint: tick | serper
set -euo pipefail

ENDPOINT="${1:?endpoint required (tick|serper)}"
ENV_FILE="/opt/visa-monitoring/.env"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "[$(date -Is)] cron-call: $ENV_FILE not readable" >&2
  exit 1
fi

CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2-)

if [[ -z "$CRON_SECRET" ]]; then
  echo "[$(date -Is)] cron-call: CRON_SECRET not set in $ENV_FILE" >&2
  exit 1
fi

echo "[$(date -Is)] cron-call: $ENDPOINT"
curl -fsS --max-time 600 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost/api/cron/$ENDPOINT"
echo
