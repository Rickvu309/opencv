#!/usr/bin/env bash
# Shared setup of test-merge-pr.sh and test-merge-pr-gates.sh: a stub gh and a throwaway repo on main.
# The caller sets `here` (the scripts directory) before sourcing this file.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

script=$here/merge-pr.sh
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d -p "$HOME/tmp")
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$MP_LOG"
ci_ok='{"check_runs":[{"name":"ci","conclusion":"success","started_at":"2026-01-01T00:00:00Z"}]}'
case "$1 $2" in
  "api user") echo "$MP_ME" ;;
  "repo view") echo "owner/repo" ;;
  "pr diff") [[ -z "${MP_DIFF_FAIL:-}" ]] || exit 1; printf '%s\n' $MP_FILES ;;
  "issue view") printf '%s\n' ${MP_LABELS:-} ;;
  "pr merge") [[ -z "${MP_MERGE_FAIL:-}" ]] || exit 1 ;;
  "api repos/owner/repo/commits/"*) jq -r "${@: -1}" <<<"${MP_CI:-$ci_ok}" ;;
  "pr view")
    case "$*" in
      *"--json headRefOid"*) echo "$MP_HEAD" ;;
      *"--json headRefName"*) echo "${MP_BRANCH:-feat/9-gone}" ;;
      *"--json author"*) jq -r "${@: -1}" <<<"{\"author\":{\"login\":\"$MP_AUTHOR\"}}" ;;
      *"--json isDraft"*) echo "${MP_DRAFT:-false}" ;;
      *"--json labels"*) printf '%s\n' ${MP_PR_LABELS:-} ;;
      *"--json mergeCommit"*) [[ -z "${MP_QUEUED:-}" ]] || { echo null; exit 0; }; jq -r "${@: -1}" <<<'{"mergeCommit":{"oid":"cafe0000cafe0000cafe0000cafe0000cafe0000"}}' ;;
      *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
    esac ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$tmp/bin/gh"
# merge-pr.sh reads the head commit when the diff names ci.yml, so the throwaway repo stands in for the checkout.
git init -q -b main "$tmp/repo" && git -C "$tmp/repo" config core.hooksPath /dev/null
git -C "$tmp/repo" commit -q --allow-empty -m base
git init -q --bare "$tmp/origin.git" && git -C "$tmp/repo" remote add origin "$tmp/origin.git"
git -C "$tmp/repo" push -q origin main
git -C "$tmp/repo" switch -q -c pr-head
echo x >"$tmp/repo/x.txt"; git -C "$tmp/repo" add x.txt; git -C "$tmp/repo" commit -q -m "feat: x (#9)"
head=$(git -C "$tmp/repo" rev-parse HEAD)
git -C "$tmp/repo" switch -q main
export MP_HEAD=$head
export PATH=$tmp/bin:$PATH MP_LOG=$tmp/gh.log
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv

reset() {
  : >"$MP_LOG"
  git -C "$tmp/repo" switch -q main 2>/dev/null || true
  git -C "$tmp/repo" reset -q --hard
  unset MP_CI MP_LABELS MP_PR_LABELS MP_DRAFT MP_DIFF_FAIL MP_MERGE_FAIL MP_QUEUED
  export MP_ME=owner MP_AUTHOR=owner MP_HEAD=$head MP_FILES="scripts/x.sh docs/y.md" MP_BRANCH=feat/9-gone
}
run() {
  set +e
  (cd "$tmp/repo" && "$script" 5 "$@") >"$tmp/out" 2>"$tmp/err"
  code=$?
  set -e
}
fail() { printf 'FAIL %s: %s\n' "$1" "$2" >&2; cat "$tmp/out" "$tmp/err" "$MP_LOG" >&2; exit 1; }
expect() {
  local name=$1 want=$2; shift 2
  [[ "$code" -eq "$want" ]] || fail "$name" "exit $code, want $want"
  local needle
  cat "$tmp/out" "$tmp/err" >"$tmp/all"
  for needle in "$@"; do grep -F -q -- "$needle" "$tmp/all" || fail "$name" "output missing: $needle"; done
  printf 'ok: %s (exit %s)\n' "$name" "$code"
}
# The result file of the last run must pass the schema check and these key=value expectations; its path is the last line.
result() {
  local f=$PR_RESULT_DIR/opencv-merge-pr-5.json
  node "$here/lib/result-check.mjs" "$f" script=merge-pr id=5 "$@" >/dev/null || fail "result file" "$(cat "$f" 2>/dev/null)"
  [[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $f" ]] || fail "result file" "RESULT_JSON is not the last line"
}
called() { grep -F -q -- "$2" "$MP_LOG" || fail "$1" "gh was not called with: $2"; }
never() { grep -F -q -- "$2" "$MP_LOG" && fail "$1" "gh was called with: $2"; return 0; }
no_merge() { never "$1" "pr merge"; }
