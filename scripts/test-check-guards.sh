#!/usr/bin/env bash
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
mkdir -p "$repo/scripts/lib" "$repo/apps/web/src" "$repo/packages/guards" "$repo/docs/adr" "$repo/.railway"
: >"$repo/scripts/open-pr.sh"
cp "$here/check.sh" "$repo/scripts/check.sh"; cp "$here/lib/result.sh" "$repo/scripts/lib/result.sh"
echo '{"name":"web"}' >"$repo/apps/web/package.json"
echo '{"name":"@workspace/guards"}' >"$repo/packages/guards/package.json"
echo '{"name":"root","scripts":{"test":"turbo test"}}' >"$repo/package.json"
: >"$repo/pnpm-lock.yaml"
git -C "$repo" init -q -b main && git -C "$repo" config core.hooksPath /dev/null
git -C "$repo" add -A && git -C "$repo" commit -q -m base
git -C "$repo" update-ref refs/remotes/origin/main HEAD
git -C "$repo" checkout -q -b feat/9-a-b

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" >&2; exit 1; }
plan() {
  mkdir -p "$repo/$(dirname "$1")"; echo change >>"$repo/$1"
  (cd "$repo" && CHECK_DRY_RUN=1 scripts/check.sh --changed test) >"$tmp/out" 2>&1 || fail "$1: dry run failed"
  git -C "$repo" checkout -q -- . && git -C "$repo" clean -qfd
}
runs() { grep -q "^\[dry-run\] pnpm exec turbo run test .*--filter=@workspace/guards" "$tmp/out"; }
# A global file runs the whole check, and `pnpm run test` is turbo test over every package, guards included.
full_runs() { grep -q "is a global file; running the full check" "$tmp/out" && grep -q "^\[dry-run\] pnpm run test" "$tmp/out"; }

plan docs/adr/0010-one-typed-contract-for-commands-and-reads.md
runs || fail "docs edit: guard package not run"
plan .railway/railway.ts
runs || full_runs || fail ".railway edit: guards not run"
plan .gitattributes
runs || full_runs || fail ".gitattributes edit: guards not run"
plan AGENTS.md
runs || fail "AGENTS edit: guard package not run"
! grep -q '^\[dry-run\] node --test' "$tmp/out" || fail "root guard list ran outside turbo"
! grep -q '^\[dry-run\] scripts/test-.*\.sh$' "$tmp/out" || fail "shell suite ran outside turbo"
echo "ok: changed tests run guards through turbo once"

plan scripts/open-pr.sh
runs || fail "open-pr edit: guard package not run"
grep -q '^\[dry-run\] pnpm exec turbo run test:open-pr ' "$tmp/out" || fail "open-pr inputs did not schedule test:open-pr"
echo "ok: open-pr inputs schedule the separate turbo task"

echo "all check guard tests passed"
