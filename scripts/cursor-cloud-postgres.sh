#!/usr/bin/env bash
# Shared Postgres package install for Cursor Cloud. Sourced by install and start.
# shellcheck disable=SC2034

ensure_postgres_packages() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if command -v psql >/dev/null 2>&1 && [ -d /usr/lib/postgresql ]; then
    return 0
  fi

  local attempt
  for attempt in 1 2 3; do
    sudo apt-get update -y || true
    if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --fix-missing \
      -o Acquire::Retries=5 postgresql postgresql-contrib; then
      return 0
    fi
    echo "postgres apt install attempt ${attempt} failed" >&2
    sleep $((attempt * 8))
  done
  echo "postgres packages are not installed yet; start will retry" >&2
  return 1
}
