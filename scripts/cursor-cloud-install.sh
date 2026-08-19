#!/usr/bin/env bash
# Idempotent Cursor Cloud bootstrap. Must terminate. Do not start servers,
# run migrations, or run tests here — see cursor-cloud-start.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install
nvm alias default "$(cat .nvmrc)"
nvm use

NODE_BIN="$(dirname "$(nvm which "$(cat .nvmrc)")")"
export PATH="$NODE_BIN:$PATH"
hash -r 2>/dev/null || true

"$NODE_BIN/npm" ci
"$NODE_BIN/npm" rebuild esbuild --foreground-scripts

if [ ! -f .env.local ]; then
  secret="$(openssl rand -hex 24)"
  sed "s/^SESSION_SECRET=.*/SESSION_SECRET=${secret}/" .env.example > .env.local
fi

if ! command -v docker >/dev/null 2>&1 && ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
fi
