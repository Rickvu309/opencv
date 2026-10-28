#!/usr/bin/env bash
# test-conflict-report.sh: scripts/lib/conflict-report.sh, on the conflicts review-pr.sh really reported
# (workflow study b_c2.json): the file lists of review-403 (apps/api/package.json), 527 (package.json), ds4b/331
# (pnpm-lock.yaml), 466 (AGENTS.md scripts/pen-snapshot.mjs) and 490c (six files under apps/). Each case builds a throwaway
# repo where main changes those files after the PR branched, and checks the report names the right commit and PR.
# The review-pr.sh run with a conflict is in test-review-pr.sh. Usage: scripts/test-conflict-report.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d "$HOME/tmp/conflict-report.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv
# shellcheck source=scripts/lib/result.sh
. "$here/lib/result.sh"
# shellcheck source=scripts/lib/conflict-report.sh
. "$here/lib/conflict-report.sh"
fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" >&2 2>/dev/null || true; exit 1; }

repo=$tmp/repo
git init -q -b main "$repo"
git -C "$repo" config core.hooksPath /dev/null
commit_files() {  # commit_files <subject> <file>...: change every file and commit
  local subject=$1 f; shift
  for f in "$@"; do mkdir -p "$repo/$(dirname "$f")"; echo "$subject" >>"$repo/$f"; done
  git -C "$repo" add -A && git -C "$repo" commit -q -m "$subject"
  git -C "$repo" rev-parse HEAD
}

# report <name> <branch> <file>...: run the report for the files; sets $out and leaves the result in $r
report() {
  local name=$1 branch=$2; shift 2
  local rc=0
  (
    set -e
    result_begin review-pr "$name"
    base=$(git -C "$repo" merge-base main "$branch")
    conflict_report "$repo" "$base" main "$branch" "$@"
    exit 1
  ) >"$tmp/out" 2>&1 || rc=$?
  (( rc == 1 )) || fail "report $name exited $rc, expected 1 from the script's own exit"
  r=$PR_RESULT_DIR/opencv-review-pr-$name.json
}
check() { node "$here/lib/result-check.mjs" "$r" script=review-pr status=fail cause=merge-conflict "$@" >/dev/null || fail "result $r: $(cat "$r")"; }
branch_from_base() {  # a PR branch off the current main that touches the files; main moves afterwards
  git -C "$repo" checkout -q -b "$1" main
  shift
  commit_files "pr work" "$@" >/dev/null
  git -C "$repo" checkout -q main
}

commit_files "base" apps/api/package.json package.json pnpm-lock.yaml AGENTS.md scripts/pen-snapshot.mjs >/dev/null

# review-403: one file, one commit on main with a PR number.
branch_from_base feat/403-x apps/api/package.json
sha=$(commit_files "chore: bump the api deps (#398)" apps/api/package.json)
report 403 feat/403-x apps/api/package.json
grep -q "apps/api/package.json: changed on main in ${sha:0:9} \"chore: bump the api deps (#398)\" (PR #398)" "$tmp/out" || fail "403 report: $(cat "$tmp/out")"
check 'files=["apps/api/package.json"]' "blockedBy={\"pr\":398,\"commit\":\"$sha\",\"files\":[\"apps/api/package.json\"]}" \
  'next=git fetch origin && git rebase origin/main'
grep -q 'git rebase origin/main && heavy -- git push --force-with-lease' "$tmp/out" || fail "403 rebase command"
echo "ok: review-403 (apps/api/package.json) names the commit and PR #398"

# 527 and ds4b/331: the root manifest and the lockfile change together on main, in one commit.
branch_from_base feat/527-x package.json pnpm-lock.yaml
sha=$(commit_files "feat: add the dnd kit (#520)" package.json pnpm-lock.yaml)
report 527 feat/527-x package.json pnpm-lock.yaml
check "blockedBy={\"pr\":520,\"commit\":\"$sha\",\"files\":[\"package.json\",\"pnpm-lock.yaml\"]}"
echo "ok: package.json and pnpm-lock.yaml changed by one commit give one blocker"

# 466: AGENTS.md and a script, changed by two different commits. The newer one is the blocker; both lines are printed.
branch_from_base feat/466-x AGENTS.md scripts/pen-snapshot.mjs
sha_old=$(commit_files "docs: pen rules (#470)" AGENTS.md)
sleep 1
sha_new=$(commit_files "fix: pen snapshot sizes (#471)" scripts/pen-snapshot.mjs)
report 466 feat/466-x AGENTS.md scripts/pen-snapshot.mjs
grep -q "AGENTS.md: changed on main in ${sha_old:0:9} \"docs: pen rules (#470)\" (PR #470)" "$tmp/out" || fail "466 first file: $(cat "$tmp/out")"
grep -q "scripts/pen-snapshot.mjs: changed on main in ${sha_new:0:9} .*(PR #471)" "$tmp/out" || fail "466 second file"
check "blockedBy={\"pr\":471,\"commit\":\"$sha_new\",\"files\":[\"scripts/pen-snapshot.mjs\"]}" 'files=["AGENTS.md","scripts/pen-snapshot.mjs"]'
grep -q 'AGENTS.md <- ' "$r" && grep -q 'pen-snapshot.mjs <- ' "$r" || fail "466 detail lists both files"
echo "ok: review 466 (AGENTS.md, scripts/pen-snapshot.mjs) lists both commits, blocker is the newer"

# 490c: six files, three on one commit; no PR number in that subject; the blocker is the commit with most files.
f6=(apps/api/src/paper/v2-document.test.ts apps/web/src/features/paper/paper-block-field.tsx apps/web/src/features/paper/paper-editor-v2-save.test.tsx apps/web/src/features/paper/paper-editor.test.tsx apps/web/src/features/paper/paper-editor.tsx apps/web/src/features/paper/paper-library.tsx)
commit_files "base paper" "${f6[@]}" >/dev/null
branch_from_base feat/490-x "${f6[@]}"
commit_files "fix: paper api test" "${f6[0]}" >/dev/null
sha3=$(commit_files "refactor: paper editor v2 (no number)" "${f6[2]}" "${f6[3]}" "${f6[4]}")
commit_files "feat: library (#505)" "${f6[5]}" >/dev/null
report 490 feat/490-x "${f6[@]}"
check "blockedBy={\"pr\":null,\"commit\":\"$sha3\",\"files\":[\"${f6[2]}\",\"${f6[3]}\",\"${f6[4]}\"]}"
grep -q "paper-block-field.tsx: not changed on main since the merge base" "$tmp/out" || fail "490 paper-block-field line"
! grep -q "base paper" "$tmp/out" || fail "490 names a commit from before the merge base"

echo "ok: review-490c (six files) picks the commit that touched most of them, PR null without (#N)"

# Files that main did not touch since the branch point get no commit and no blockedBy, even when an older commit did.
branch_from_base feat/old-x "${f6[0]}"
report old feat/old-x "${f6[0]}"
grep -q "${f6[0]}: not changed on main since the merge base" "$tmp/out" || fail "old-only line: $(cat "$tmp/out")"
! grep -q 'changed on main in' "$tmp/out" || fail "old-only names a commit: $(cat "$tmp/out")"
check 'blockedBy=null'
echo "ok: a file main changed only before the merge base names no commit and sets no blockedBy"

# A glob character in a file name matches only that file, and a non-ASCII name is found unquoted.
glob='apps/web/[id].tsx'; other='apps/web/i.tsx'; uni='apps/web/café.tsx'
commit_files "base globs" "$glob" "$other" "$uni" >/dev/null
branch_from_base feat/glob-x "$glob" "$uni"
sha_other=$(commit_files "fix: only the lookalike (#600)" "$other")
sha_uni=$(commit_files "fix: the accent (#601)" "$uni")
report glob feat/glob-x "$glob" "$uni"
grep -q "\[id\].tsx: not changed on main since the merge base" "$tmp/out" || fail "glob matched a lookalike: $(cat "$tmp/out")"
grep -q "café.tsx: changed on main in ${sha_uni:0:9}" "$tmp/out" || fail "non-ASCII name not found: $(cat "$tmp/out")"
echo "ok: glob characters and non-ASCII names are matched literally"

# The rebase command starts with a cd when this clone has a worktree on the branch.
git -C "$repo" worktree add -q "$tmp/wt" feat/403-x
report 403wt feat/403-x apps/api/package.json
check "next=cd \"$tmp/wt\" && git fetch origin && git rebase origin/main"
echo "ok: the next command goes to the branch's worktree"

# A worktree path with a dollar sign is escaped so the printed command still runs.
git -C "$repo" worktree add -q "$tmp/w\$t" -b feat/dollar-x main
report dollar feat/dollar-x apps/api/package.json
dollar_cmd=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).next)' "$r")
[[ "$(bash -c "${dollar_cmd%% && git*} && pwd")" == "$tmp/w\$t" ]] || fail "dollar path not escaped: $dollar_cmd"
echo "ok: a worktree path with a dollar sign is escaped in the next command"
echo "all conflict report tests passed"
