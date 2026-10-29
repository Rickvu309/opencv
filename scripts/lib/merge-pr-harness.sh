#!/usr/bin/env bash
# Shared setup of test-merge-pr.sh and test-merge-pr-gates.sh: a stub gh, a stub review command and a throwaway repo on main.
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
  "api repos/owner/repo/branches/main") echo "${MP_MAIN:-1234567890ab00000000000000000000000000ff}" ;;
  "api repos/owner/repo/compare/"*) [[ -z "${MP_COMPARE_FAIL:-}" ]] || exit 1; printf '%s\n' ${MP_COMPARE_FILES:-} ;;
  "api repos/owner/repo/commits/"*) jq -r "${@: -1}" <<<"${MP_CI:-$ci_ok}" ;;
  "issue view") printf '%s\n' ${MP_LABELS:-} ;;
  "pr merge") [[ -z "${MP_MERGE_FAIL:-}" ]] || exit 1 ;;
  "api repos/owner/repo/statuses/"*) ;;
  "pr view")
    case "$*" in
      *"--json body"*) jq -r "${@: -1}" < <(jq -nc --arg b "${MP_BODY:-}" '{body:$b}') ;;
      *"--json headRefOid"*) echo "$MP_HEAD" ;;
      *"--json headRefName"*) echo "${MP_BRANCH:-feat/9-gone}" ;;
      *"--json author"*) jq -r "${@: -1}" <<<"{\"author\":{\"login\":\"$MP_AUTHOR\"}}" ;;
      *"--json comments,reviews"*) jq -r "${@: -1}" <<<"$MP_EVIDENCE" ;;
      *"--json mergeCommit"*) jq -r "${@: -1}" <<<'{"mergeCommit":{"oid":"cafe0000cafe0000cafe0000cafe0000cafe0000"}}' ;;
      *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
    esac ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
STUB
cat >"$tmp/review" <<'STUB'
#!/usr/bin/env bash
# The first call answers MP_REVIEW_OUT/RC; every later call (the --regate rerun) answers MP_REVIEW_OUT2/RC2 when set.
n=$(( $(cat "$MP_COUNT" 2>/dev/null || echo 0) + 1 )); echo "$n" >"$MP_COUNT"
echo "review-pr: working on $1 (call $n)"
if (( n > 1 )) && [[ -n "${MP_REVIEW_OUT2:-}" ]]; then printf '%s\n' "$MP_REVIEW_OUT2"; exit "${MP_REVIEW_RC2:-0}"; fi
printf '%s\n' "$MP_REVIEW_OUT"
exit "$MP_REVIEW_RC"
STUB
chmod +x "$tmp/bin/gh" "$tmp/review"
# merge-pr.sh runs from the main checkout: a throwaway repo on main stands in for it.
git init -q -b main "$tmp/repo" && git -C "$tmp/repo" config core.hooksPath /dev/null
git -C "$tmp/repo" commit -q --allow-empty -m base
git init -q --bare "$tmp/origin.git" && git -C "$tmp/repo" remote add origin "$tmp/origin.git"
git -C "$tmp/repo" push -q origin main
# The PR head is a real commit on a branch off main, so the commit checks have something to read.
git -C "$tmp/repo" switch -q -c pr-head
echo x >"$tmp/repo/x.txt"; git -C "$tmp/repo" add x.txt; git -C "$tmp/repo" commit -q -m "feat: x (#9)"
head=$(git -C "$tmp/repo" rev-parse HEAD)
git -C "$tmp/repo" switch -q main
export HEAVY_SLOT=1 MP_HEAD=$head
export PATH=$tmp/bin:$PATH MP_LOG=$tmp/gh.log MERGE_PR_REVIEW_CMD=$tmp/review
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv MP_COUNT=$tmp/review-count

patch=0123456789abcdef0123456789abcdef01234567
old=ffffffffffffffffffffffffffffffffffffffff
ok_line="RESULT: OK (patch id $patch, main 1234567890ab). Check the verify-opencv evidence, then: gh pr merge 5 --squash --match-head-commit $head"
evidence() { jq -nc --arg c "$1" '{comments:[{body:$c}],reviews:[]}'; }
full="review-pr.sh: OK (patch id $patch, main 1234567890ab). Independent review: sol-loop, approved. verify-opencv: PASS"
review_only="review-pr.sh: OK (patch id $patch, main 1234567890ab). Independent review: sol-loop, approved."

reset() {
  : >"$MP_LOG"; rm -f "$MP_COUNT"; unset MP_BODY MP_BRANCH; export MP_HEAD=$head; rm -rf "$tmp/repo/.git/pre-push-stamps"; export HEAVY_SLOT=1
  mkdir -p "$tmp/repo/.git/pre-push-stamps"; echo ok >"$tmp/repo/.git/pre-push-stamps/$head"
  git -C "$tmp/repo" switch -q main 2>/dev/null || true; git -C "$tmp/repo" reset -q --hard; unset MP_CI MP_LABELS MP_REVIEW_OUT2 MP_REVIEW_RC2 MP_COMPARE_FILES MP_COMPARE_FAIL MP_MAIN
  export MP_ME=owner MP_AUTHOR=owner MP_REVIEW_RC=0 MP_REVIEW_OUT=$ok_line MP_FILES="scripts/x.sh docs/y.md"
  MP_EVIDENCE=$(evidence "$full"); export MP_EVIDENCE
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
no_merge() { never "$1" "api repos/owner/repo/statuses/"; never "$1" "pr merge"; }
no_writes() { never "$1" "api repos/"; never "$1" "pr merge"; }
never_gated() { [[ ! -e "$MP_COUNT" ]] || fail "$1" "the review gate ran: a refusal that needs no gate must come before it"; }
