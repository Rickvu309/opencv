#!/usr/bin/env bash
# test-check-guards.sh: scripts/check.sh --changed always runs the root node:test guards (CHECK_DRY_RUN=1 prints the plan).
# The guard list is the .test.mjs files of the root package.json `test` script; scripts/open-pr.test.mjs (40 s) is the
# one guard that runs only when its own inputs changed.
# Usage: scripts/test-check-guards.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN CHECK_BASE_REF CHECK_RETRY_FAILED_TESTS PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d "$HOME/tmp/check-guards-test-XXXXXX")
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv

mkdir "$tmp/bin"
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp/bin/pnpm"; chmod +x "$tmp/bin/pnpm"
export PATH=$tmp/bin:$PATH

repo=$tmp/repo
mkdir -p "$repo/scripts/lib" "$repo/apps/web/src" "$repo/docs/adr" "$repo/.railway"
cp "$here/check.sh" "$repo/scripts/check.sh"; cp "$here/lib/result.sh" "$repo/scripts/lib/result.sh"
echo '{"name":"web"}' >"$repo/apps/web/package.json"
cat >"$repo/package.json" <<'JSON'
{"name":"root","scripts":{"test":"node --test scripts/open-pr.test.mjs scripts/adr-citations.test.mjs scripts/retired-words.test.mjs && turbo test"}}
JSON
for f in open-pr adr-citations retired-words; do : >"$repo/scripts/$f.test.mjs"; done
: >"$repo/scripts/open-pr.sh"; : >"$repo/pnpm-lock.yaml"
git -C "$repo" init -q -b main && git -C "$repo" config core.hooksPath /dev/null
git -C "$repo" add -A && git -C "$repo" commit -q -m base
git -C "$repo" update-ref refs/remotes/origin/main HEAD
git -C "$repo" checkout -q -b feat/9-a-b

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" >&2; exit 1; }
plan() {  # plan <file>: the dry-run plan of a branch that changes only <file>
  mkdir -p "$repo/$(dirname "$1")"; echo change >>"$repo/$1"
  (cd "$repo" && CHECK_DRY_RUN=1 scripts/check.sh --changed test) >"$tmp/out" 2>&1 || fail "$1: dry run failed"
  git -C "$repo" checkout -q -- . && git -C "$repo" clean -qfd
}
runs() { grep -q "^\[dry-run\] node --test .*$1" "$tmp/out"; }

plan docs/adr/0001-x.md
runs scripts/adr-citations.test.mjs || fail "adr edit: adr-citations not run"
! runs scripts/open-pr.test.mjs || fail "adr edit: open-pr.test.mjs ran"
echo "ok: a docs/adr edit runs adr-citations"

plan .railway/railway.ts
runs scripts/retired-words.test.mjs || fail ".railway edit: guards not run"
echo "ok: a .railway/railway.ts edit runs the guards"

plan scripts/retired-words.test.mjs
runs scripts/retired-words.test.mjs || fail "guard edit: the edited guard did not run"
echo "ok: an edit of a guard runs it"

plan apps/web/src/a.ts
runs scripts/adr-citations.test.mjs || fail "web edit: guards not run"
! runs scripts/open-pr.test.mjs || fail "web edit: open-pr.test.mjs ran"
echo "ok: a plain apps/web edit runs the guards but not open-pr.test.mjs"

for f in scripts/open-pr.sh scripts/lib/rules.sh scripts/open-pr.test.mjs; do
  plan "$f"
  runs scripts/open-pr.test.mjs || fail "$f edit: open-pr.test.mjs did not run"
done
echo "ok: open-pr.sh, scripts/lib/* and its own test run open-pr.test.mjs"
echo "all check guard tests passed"
