#!/usr/bin/env bash
# Usage: doctor.sh <run-id>
# Read-only. Prints one PASS or FAIL line per check, exits non-zero if any check fails.
set -uo pipefail

RUN="${1:-}"
EVIDENCE="${OPENCV_VERIFY_ROOT:-$HOME/tmp/opencv-verify}/$RUN"
RUN_ENV="$EVIDENCE/run.env"
if [[ -z "$RUN" || ! -f "$RUN_ENV" ]]; then
  echo "FAIL run.env (no $RUN_ENV; usage: doctor.sh <run-id>)"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$RUN_ENV"
set +a

failed=0
check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    failed=1
  fi
}

listener_pid() {
  ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
}
alive() { kill -0 "$1" 2>/dev/null; }
owns_port() { [[ "$(listener_pid "$2")" == "$1" ]]; }
marked() { tr '\0' '\n' < "/proc/$1/environ" 2>/dev/null | grep -qx "OPENCV_VERIFY_RUN=$RUN"; }
health_ok() { [[ "$(curl -s --max-time 5 "$API_URL/health")" == '{"ok":true}' ]]; }
session_ok() {
  local code
  code=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$API_URL/api/session")
  [[ "$code" == 401 || "$code" == 200 ]]
}
web_ok() { [[ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$WEB_URL/")" == 200 ]]; }
head_ok() { [[ "$(git -C "$REPO" rev-parse HEAD)" == "$HEAD_SHA" ]]; }

check api-pid alive "$API_PID"
check api-owned marked "$API_PID"
check api-port owns_port "$API_PID" "$API_PORT"
check web-pid alive "$WEB_PID"
check web-owned marked "$WEB_PID"
check web-port owns_port "$WEB_PID" "$WEB_PORT"
check health health_ok
check session session_ok
check web web_ok
check head head_ok
check data-dir test -d "$DATA_DIR"
exit "$failed"
