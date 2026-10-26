#!/usr/bin/env bash
# Usage: launch.sh <run-id>
# Starts the OpenCV api (PGlite, scripted coach) and web dev server for one verification run.
# Prints "READY api=<port> web=<port> run=<run>" when the stack is usable.
# OPENCV_API_PORT and OPENCV_WEB_PORT pin the ports; LAUNCH_WAIT_SECONDS bounds each readiness wait.
set -euo pipefail

RUN="${1:-}"
if [[ ! "$RUN" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "usage: launch.sh <run-id>   (letters, digits, . _ - only)" >&2
  exit 2
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
EVIDENCE_ROOT="${OPENCV_VERIFY_ROOT:-$HOME/tmp/opencv-verify}"
EVIDENCE="$EVIDENCE_ROOT/$RUN"
DATA_DIR="$REPO/apps/api/.data/verify-$RUN"
RUN_ENV="$EVIDENCE/run.env"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAIT_SECONDS="${LAUNCH_WAIT_SECONDS:-240}"

owned_by_run() {
  tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | grep -qx "OPENCV_VERIFY_RUN=$RUN"
}

if [[ -f "$RUN_ENV" ]]; then
  old_pgid=$(sed -n 's/^API_PGID=//p' "$RUN_ENV")
  for pid in $(ps -eo pid=,pgid= | awk -v g="${old_pgid:-0}" '$2==g{print $1}'); do
    if owned_by_run "$pid"; then
      echo "run '$RUN' is already running; run cleanup.sh $RUN first or pick another id" >&2
      exit 1
    fi
  done
fi

free_port() {
  python3 -c 'import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()'
}

listener_pid() {
  ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
}

wait_for() {
  local what="$1" deadline=$((SECONDS + $2))
  shift 2
  until "$@" >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then
      echo "timed out waiting for $what" >&2
      return 1
    fi
    sleep 1
  done
}

had_data=0
[[ -d "$DATA_DIR" ]] && had_data=1

fail() {
  echo "launch failed: $1" >&2
  tail -n 20 "$EVIDENCE/api.log" 2>/dev/null | sed 's/^/api.log: /' >&2 || true
  tail -n 20 "$EVIDENCE/web.log" 2>/dev/null | sed 's/^/web.log: /' >&2 || true
  KEEP_DATA="$had_data" bash "$HERE/cleanup.sh" "$RUN" >&2 || true
  exit 1
}

mkdir -p "$EVIDENCE" "$DATA_DIR"
API_PORT="${OPENCV_API_PORT:-$(free_port)}"
WEB_PORT="${OPENCV_WEB_PORT:-$(free_port)}"
while [[ "$WEB_PORT" == "$API_PORT" ]]; do WEB_PORT=$(free_port); done
API_URL="http://localhost:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"
SESSION_SECRET_VALUE=$(python3 -c 'import secrets; print(secrets.token_hex(24))')
echo "--- boot $(date -u +%FT%TZ) ---" | tee -a "$EVIDENCE/api.log" >> "$EVIDENCE/web.log"

(
  cd "$REPO"
  setsid env -u OPENROUTER_API_KEY -u DATABASE_URL -u NODE_ENV \
    OPENCV_VERIFY_RUN="$RUN" DB_DRIVER=pglite COACH_RUNTIME=fake \
    PGLITE_DATA_DIR="$DATA_DIR" SESSION_SECRET="$SESSION_SECRET_VALUE" \
    AUTH_URL="$API_URL" WEB_ORIGINS="$WEB_URL" PORT="$API_PORT" \
    pnpm --filter api dev </dev/null >> "$EVIDENCE/api.log" 2>&1 &
  echo $! > "$EVIDENCE/.api.pgid"
)
(
  cd "$REPO"
  setsid env OPENCV_VERIFY_RUN="$RUN" VITE_API_URL="$API_URL" \
    pnpm --filter web dev --port "$WEB_PORT" --strictPort </dev/null >> "$EVIDENCE/web.log" 2>&1 &
  echo $! > "$EVIDENCE/.web.pgid"
)
API_PGID=$(cat "$EVIDENCE/.api.pgid")
WEB_PGID=$(cat "$EVIDENCE/.web.pgid")
rm -f "$EVIDENCE/.api.pgid" "$EVIDENCE/.web.pgid"
printf 'RUN=%s\nAPI_PGID=%s\nWEB_PGID=%s\n' "$RUN" "$API_PGID" "$WEB_PGID" > "$RUN_ENV"

health_ok() { [[ "$(curl -s "$API_URL/health")" == '{"ok":true}' ]]; }
web_ok() { [[ "$(curl -s -o /dev/null -w '%{http_code}' "$WEB_URL/")" == 200 ]]; }

wait_for "api /health" "$WAIT_SECONDS" health_ok || fail "api did not answer /health"
wait_for "web root" "$WAIT_SECONDS" web_ok || fail "web did not answer 200"

API_PID=$(listener_pid "$API_PORT")
WEB_PID=$(listener_pid "$WEB_PORT")
[[ -n "$API_PID" && -n "$WEB_PID" ]] || fail "could not find the listener pid for a port"

PROBE_EMAIL="launch-probe-$(date +%s%N)@verify.local"
send_code=$(curl -s -o "$EVIDENCE/launch-probe-send.json" -w '%{http_code}' \
  -X POST "$API_URL/api/auth/email-otp/send-verification-otp" \
  -H 'content-type: application/json' -H "origin: $WEB_URL" \
  -d "{\"email\":\"$PROBE_EMAIL\",\"type\":\"sign-in\"}")
[[ "$send_code" == 200 ]] || fail "probe send returned $send_code"
probe_otp=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  probe_otp=$(grep -E "\[auth\] email code for ${PROBE_EMAIL} type sign-in: [0-9]{6}" "$EVIDENCE/api.log" | tail -n 1 | grep -Eo '[0-9]{6}$' || true)
  [[ -n "$probe_otp" ]] && break
  sleep 0.2
done
[[ -n "$probe_otp" ]] || fail "probe code was not logged"
probe_code=$(curl -s -o "$EVIDENCE/launch-probe.json" -w '%{http_code}' \
  -X POST "$API_URL/api/auth/sign-in/email-otp" \
  -H 'content-type: application/json' -H "origin: $WEB_URL" \
  -d "{\"email\":\"$PROBE_EMAIL\",\"otp\":\"$probe_otp\",\"name\":\"Launch Probe\"}")
[[ "$probe_code" == 200 ]] || fail "probe sign-in returned $probe_code"

cat > "$RUN_ENV" <<ENV
RUN=$RUN
REPO=$REPO
HEAD_SHA=$(git -C "$REPO" rev-parse HEAD)
EVIDENCE_DIR=$EVIDENCE
DATA_DIR=$DATA_DIR
API_PORT=$API_PORT
API_URL=$API_URL
API_PID=$API_PID
API_PGID=$API_PGID
WEB_PORT=$WEB_PORT
WEB_URL=$WEB_URL
WEB_PID=$WEB_PID
WEB_PGID=$WEB_PGID
DB_DRIVER=pglite
COACH_RUNTIME=fake
OPENROUTER_API_KEY=unset
PROBE_EMAIL=$PROBE_EMAIL
LAUNCHED_AT=$(date -u +%FT%TZ)
ENV

echo "READY api=$API_PORT web=$WEB_PORT run=$RUN"
