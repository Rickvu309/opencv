#!/usr/bin/env bash
# Usage: [KEEP_DATA=1] cleanup.sh <run-id>
# Stops the processes launch.sh started (found by process group plus the OPENCV_VERIFY_RUN
# marker in their environment, never by name) and removes the run's PGlite data dir.
# The evidence dir is never deleted. Safe to run twice.
set -uo pipefail

RUN="${1:-}"
EVIDENCE="${OPENCV_VERIFY_ROOT:-$HOME/tmp/opencv-verify}/$RUN"
RUN_ENV="$EVIDENCE/run.env"
if [[ -z "$RUN" ]]; then
  echo "usage: cleanup.sh <run-id>" >&2
  exit 2
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
DATA_DIR="$REPO/apps/api/.data/verify-$RUN"
pgids=()
if [[ -f "$RUN_ENV" ]]; then
  api_pgid=$(sed -n 's/^API_PGID=//p' "$RUN_ENV")
  web_pgid=$(sed -n 's/^WEB_PGID=//p' "$RUN_ENV")
  pgids=("$api_pgid" "$web_pgid")
fi

run_members() {
  local pgid="$1" pid
  [[ "$pgid" =~ ^[0-9]+$ ]] || return 0
  for pid in $(ps -eo pid=,pgid= | awk -v g="$pgid" '$2==g{print $1}'); do
    if tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -qx "OPENCV_VERIFY_RUN=$RUN"; then
      echo "$pid"
    fi
  done
}

signal_all() {
  local sig="$1" pgid pid
  for pgid in "${pgids[@]}"; do
    for pid in $(run_members "$pgid"); do
      kill "-$sig" "$pid" 2>/dev/null || true
    done
  done
}

signal_all TERM
for _ in 1 2 3 4 5 6 7 8 9 10; do
  remaining=0
  for pgid in "${pgids[@]}"; do
    [[ -n "$(run_members "$pgid")" ]] && remaining=1
  done
  ((remaining == 0)) && break
  sleep 0.5
done
signal_all KILL

if [[ "${KEEP_DATA:-0}" == 1 ]]; then
  echo "kept $DATA_DIR"
elif [[ -d "$DATA_DIR" ]]; then
  rm -rf "$DATA_DIR"
  echo "removed $DATA_DIR"
fi
echo "cleanup done run=$RUN evidence kept at $EVIDENCE"
exit 0
