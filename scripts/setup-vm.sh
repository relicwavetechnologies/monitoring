#!/usr/bin/env bash
# One-time VM bootstrap. Run as the user that will own the deployment (NOT root).
# Usage:  bash setup-vm.sh
set -euo pipefail

APP_DIR="/opt/visa-monitoring"
REPO_RAW="https://raw.githubusercontent.com/relicwavetechnologies/monitoring/main"

if [[ "$EUID" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
fi
if [[ -n "$SUDO" ]]; then
  $SUDO usermod -aG docker "$USER" || true
fi

echo "==> Creating $APP_DIR"
$SUDO mkdir -p "$APP_DIR"
$SUDO chown "$USER":"$USER" "$APP_DIR"

echo "==> Fetching deployment files"
curl -fsSL "$REPO_RAW/docker-compose.yml" -o "$APP_DIR/docker-compose.yml"
curl -fsSL "$REPO_RAW/Caddyfile"          -o "$APP_DIR/Caddyfile"
curl -fsSL "$REPO_RAW/scripts/cron-call.sh" -o "$APP_DIR/cron-call.sh"
chmod +x "$APP_DIR/cron-call.sh"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<'EOF'
# ── Database (Neon) ──────────────────────────────────────────────────────────
DATABASE_URL=
DIRECT_URL=

# ── Auth (NextAuth v5) ───────────────────────────────────────────────────────
AUTH_SECRET=
AUTH_URL=http://YOUR_VM_IP

# ── Email (Resend) ───────────────────────────────────────────────────────────
RESEND_API_KEY=
AUTH_RESEND_KEY=
RESEND_FROM=onboarding@resend.dev

# ── AI Gateway ───────────────────────────────────────────────────────────────
OPENAI_API_KEY=
OPENAI_BASE_URL=https://gateway-v21w.onrender.com/v1

# ── Discovery ────────────────────────────────────────────────────────────────
SERPER_API_KEY=

# ── Cron security ────────────────────────────────────────────────────────────
CRON_SECRET=

# ── Optional sign-in whitelist (empty = anyone) ──────────────────────────────
# ALLOWED_EMAILS=you@example.com,team@example.com
EOF
  chmod 600 "$APP_DIR/.env"
  echo "==> Created $APP_DIR/.env stub — edit it with real values before continuing"
fi

echo "==> Installing host crontab"
CRON_TMP=$(mktemp)
crontab -l 2>/dev/null > "$CRON_TMP" || true
# Remove any prior visa-monitoring lines
sed -i '/visa-monitoring/d' "$CRON_TMP"
cat >> "$CRON_TMP" <<EOF
# visa-monitoring
*/5 * * * * $APP_DIR/cron-call.sh tick    >> /var/log/visa-cron.log 2>&1 # visa-monitoring
0 8 * * *   $APP_DIR/cron-call.sh serper  >> /var/log/visa-cron.log 2>&1 # visa-monitoring
EOF
crontab "$CRON_TMP"
rm "$CRON_TMP"
$SUDO touch /var/log/visa-cron.log
$SUDO chown "$USER":"$USER" /var/log/visa-cron.log

echo
echo "Done. Next steps:"
echo "  1. Edit $APP_DIR/.env with real secrets"
if [[ -n "$SUDO" ]]; then
  echo "  2. Log out and back in (so docker group takes effect)"
fi
echo "  3. Trigger the deploy workflow on GitHub (Actions → deploy → Run workflow)"
