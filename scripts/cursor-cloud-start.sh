#!/usr/bin/env bash
# Per-boot Cursor Cloud services: Postgres, then schema migrations.
set -euo pipefail
cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use
NODE_BIN="$(dirname "$(nvm which "$(cat .nvmrc)")")"
export PATH="$NODE_BIN:$PATH"
hash -r 2>/dev/null || true

wait_for_pg() {
  local url="${1:-postgres://postgres:postgres@127.0.0.1:5432/openpath}"
  local i
  for i in $(seq 1 40); do
    if DATABASE_URL="$url" "$NODE_BIN/node" --input-type=module -e "
      import pg from 'pg';
      const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: false });
      await c.connect();
      await c.end();
    "; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready on 5432" >&2
  return 1
}

# shellcheck disable=SC1091
. "$(dirname "$0")/cursor-cloud-postgres.sh"

ensure_local_db() {
  ensure_postgres_packages

  local version
  version="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -n 1 || true)"
  if [ -n "$version" ] && command -v pg_ctlcluster >/dev/null 2>&1; then
    sudo pg_ctlcluster "$version" main start 2>/dev/null || true
  fi
  if command -v service >/dev/null 2>&1; then
    sudo service postgresql start 2>/dev/null || true
  fi

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
ALTER ROLE postgres WITH LOGIN PASSWORD 'postgres';
SELECT 'CREATE DATABASE openpath OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'openpath')\gexec
SQL
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker compose up -d
else
  ensure_local_db
fi

wait_for_pg "postgres://postgres:postgres@127.0.0.1:5432/openpath"
"$NODE_BIN/npm" run db:migrate
