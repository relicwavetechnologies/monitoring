#!/usr/bin/env bash
# One-time VM bootstrap. Run as the user that will own the deployment (NOT root).
# Usage:  bash setup-vm.sh
set -euo pipefail

APP_DIR="/opt/visa-monitoring"
REPO_RAW="https://raw.githubusercontent.com/relicwavetechnologies/monitoring/main"

if [[ "$EUID" -eq 0 ]]; then
  echo "Run this as a regular user with sudo, not as root." >&2
  exit 1
fi

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true

echo "==> Creating $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

echo "==> Fetching deployment files"
curl -fsSL "$REPO_RAW/docker-compose.yml" -o "$APP_DIR/docker-compose.yml"
curl -fsSL "$REPO_RAW/Caddyfile"          -o "$APP_DIR/Caddyfile"
curl -fsSL "$REPO_RAW/scripts/cron-call.sh" -o "$APP_DIR/cron-call.sh"
chmod +x "$APP_DIR/cron-call.sh"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<'EOF'
# Required
DATABASE_URL=
NEXTAUTH_URL=http://YOUR_VM_IP
NEXTAUTH_SECRET=
CRON_SECRET=
OPENAI_API_KEY=
RESEND_API_KEY=

# Optional / has defaults
OPENAI_BASE_URL=https://gateway-v21w.onrender.com/v1
RESEND_FROM=onboarding@resend.dev
SERPER_API_KEY=
# Comma-separated whitelist of emails allowed to sign in. Empty = anyone.
ALLOWED_EMAILS=
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
sudo touch /var/log/visa-cron.log
sudo chown "$USER":"$USER" /var/log/visa-cron.log

echo
echo "Done. Next steps:"
echo "  1. Log out and back in (so docker group takes effect)"
echo "  2. Edit $APP_DIR/.env with real secrets"
echo "  3. Add GitHub repo secrets (see CI workflow):"
echo "       SSH_HOST, SSH_USER, SSH_KEY, DATABASE_URL"
echo "  4. Push to main — first deploy will run automatically"
