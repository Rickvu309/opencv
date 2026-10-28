#!/usr/bin/env bash
# Usage: port-owner.sh <port> <pgid>
# Exits 0 when every listener on the port descends from the process group <pgid>, the group a launcher started with
# setsid: the listener, or one of its ancestors, is in that group. A dev server can start its own group (tsx does), so
# the listener's own group is not enough. Exits 1 otherwise (a foreign listener, or none that can be seen), so a run
# never drives a server it did not start.
set -uo pipefail

port="${1:-}"
pgid="${2:-}"
if [[ ! "$port" =~ ^[0-9]+$ || ! "$pgid" =~ ^[0-9]+$ ]]; then
  echo "usage: port-owner.sh <port> <pgid>" >&2
  exit 2
fi

descends_from() {
  local pid="$1" ppid group depth=0
  while [[ "$pid" =~ ^[0-9]+$ ]] && ((pid > 1 && depth++ < 64)); do
    read -r ppid group < <(ps -o ppid=,pgid= -p "$pid" 2>/dev/null) || return 1
    [[ "$pid" == "$pgid" || "$group" == "$pgid" ]] && return 0
    pid="$ppid"
  done
  return 1
}

pids=$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
if [[ -z "$pids" ]]; then
  echo "port $port is in use by a process this launch did not start (no listener pid visible)" >&2
  exit 1
fi
for pid in $pids; do
  if ! descends_from "$pid"; then
    echo "port $port is in use by pid $pid, which does not descend from the group $pgid this launch started" >&2
    exit 1
  fi
done
