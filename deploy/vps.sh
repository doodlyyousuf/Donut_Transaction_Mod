#!/usr/bin/env bash
#
# Local control script for the VPS. This is the single entry point:
#
#   ./deploy/vps.sh ssh                 # interactive shell on the VPS
#   ./deploy/vps.sh ssh "uptime"        # run one command remotely
#   ./deploy/vps.sh push                # build the frontend, copy code up
#   ./deploy/vps.sh bootstrap           # first-time provision (push + setup)
#   ./deploy/vps.sh update              # push, migrate, restart the service
#   ./deploy/vps.sh status              # service + health check
#   ./deploy/vps.sh logs                # tail the API log
#   ./deploy/vps.sh show                # print the resolved config
#
# Configuration lives in deploy/vps.env (gitignored). See vps.env.example.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/vps.env"
SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/donutsmp_vps}"

die() { echo "error: $*" >&2; exit 1; }

if [ ! -f "$ENV_FILE" ]; then
    die "missing $ENV_FILE - copy deploy/vps.env.example to deploy/vps.env and fill it in"
fi

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${VPS_HOST:?set VPS_HOST in deploy/vps.env}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
VPS_HOSTNAME="${VPS_HOSTNAME:-$VPS_HOST}"
VPS_USE_TLS="${VPS_USE_TLS:-0}"
VPS_FRONTEND_PORT="${VPS_FRONTEND_PORT:-18701}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/donutsmp-tracker}"
DB_NAME="${DB_NAME:-donutsmp}"
DB_USER="${DB_USER:-donut}"
SVC_NAME="donutsmp-api"

[ -f "$SSH_KEY" ] || die "SSH key not found at $SSH_KEY (set VPS_SSH_KEY to override)"

SSH_OPTS=(-i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=accept-new
          -o ServerAliveInterval=30 -o ConnectTimeout=15)
TARGET="$VPS_USER@$VPS_HOST"

# Root logins can run commands directly; everyone else goes through sudo.
remote_root() {
    if [ "$VPS_USER" = "root" ]; then
        ssh "${SSH_OPTS[@]}" "$TARGET" "$@"
    else
        ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -n bash -lc $(printf '%q' "$*")"
    fi
}

cmd_ssh() {
    if [ "$#" -eq 0 ]; then
        ssh "${SSH_OPTS[@]}" -t "$TARGET"
    else
        ssh "${SSH_OPTS[@]}" "$TARGET" "$@"
    fi
}

cmd_show() {
    cat <<EOF
host        : $TARGET
port        : $VPS_PORT
key         : $SSH_KEY
hostname    : $VPS_HOSTNAME
tls         : $VPS_USE_TLS
front port  : $VPS_FRONTEND_PORT
remote dir  : $REMOTE_DIR
database    : $DB_NAME (owner $DB_USER)
service     : $SVC_NAME
EOF
}

cmd_push() {
    echo "==> Building frontend"
    (cd "$ROOT/frontend" && npm run build >/dev/null)

    echo "==> Copying code to $TARGET:$REMOTE_DIR"
    ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$REMOTE_DIR'"
    rsync -az --delete \
        -e "ssh -i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=accept-new" \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude 'backend/.venv' \
        --exclude 'backend/.env' \
        --exclude '__pycache__' \
        --exclude '*.pyc' \
        --exclude '*.db' \
        --exclude 'backend/alembic_tmp.db' \
        "$ROOT/backend" "$ROOT/deploy" "$ROOT/frontend" \
        "$TARGET:$REMOTE_DIR/"

    # The API serves mod jars from ../minecraft-mod/dist (mod_dist_dir), which
    # lives outside the three trees above. Copy just the built jars.
    echo "==> Copying mod builds to $TARGET:$REMOTE_DIR/minecraft-mod/dist"
    ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$REMOTE_DIR/minecraft-mod/dist'"
    rsync -az --delete \
        -e "ssh -i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=accept-new" \
        --include '*/' --include '*.jar' --exclude '*' \
        "$ROOT/minecraft-mod/dist/" "$TARGET:$REMOTE_DIR/minecraft-mod/dist/"
}

cmd_bootstrap() {
    cmd_push
    echo "==> Provisioning the server (this can take a few minutes)"
    local args
    args="$(printf '%q ' "$VPS_HOSTNAME" "$VPS_USE_TLS" "$LETSENCRYPT_EMAIL" "$DB_NAME" "$DB_USER" "$REMOTE_DIR" "$VPS_FRONTEND_PORT")"
    if [ "$VPS_USER" = "root" ]; then
        ssh "${SSH_OPTS[@]}" "$TARGET" "bash -s -- $args" < "$ROOT/deploy/vps-setup.sh"
    else
        ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -n bash -s -- $args" < "$ROOT/deploy/vps-setup.sh"
    fi
}

cmd_update() {
    cmd_push
    remote_root "cd '$REMOTE_DIR/backend' && '$REMOTE_DIR/backend/.venv/bin/python' -m alembic upgrade head && chown -R donut:donut '$REMOTE_DIR' && systemctl restart $SVC_NAME && sleep 2 && systemctl is-active $SVC_NAME"
    cmd_status
}

cmd_status() {
    echo "==> Service"
    remote_root "systemctl status $SVC_NAME --no-pager -l | head -n 12" || true
    echo "==> Health"
    cmd_ssh "curl -fsS http://127.0.0.1:18700/api/health" || echo "(health check failed)"
    echo
    if [ "$VPS_USE_TLS" = "1" ]; then
        echo "Dashboard: https://$VPS_HOSTNAME"
    else
        echo "Dashboard: http://$VPS_HOSTNAME:$VPS_FRONTEND_PORT"
    fi
}

cmd_logs() {
    remote_root "journalctl -u $SVC_NAME -f -n 80"
}

case "${1:-}" in
    ssh)      shift; cmd_ssh "$@" ;;
    push)     cmd_push ;;
    bootstrap) cmd_bootstrap ;;
    update)   cmd_update ;;
    status)   cmd_status ;;
    logs)     cmd_logs ;;
    show)     cmd_show ;;
    "")
        sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        ;;
    *)
        die "unknown command '$1' (try: ssh, push, bootstrap, update, status, logs, show)"
        ;;
esac
