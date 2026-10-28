#!/usr/bin/env bash
# test-check-retry.sh: the retry-once of scripts/check.sh (CHECK_RETRY_FAILED_TESTS=1, set by open-pr.sh only).
# The failures are real vitest FAIL lines from past runs that passed on the next run (scripts/fixtures/check-flaky-*.txt,
# from pstack-run 20261028T014507Z-nmimjadj and 20261026T205005Z-gzts2402). pnpm is a stub that prints them, so no suite runs.
# Usage: scripts/test-check-retry.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN CHECK_BASE_REF CHECK_RETRY_FAILED_TESTS PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv STUB_LOG=$tmp/pnpm.log

mkdir "$tmp/bin"
cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
# turbo test prints STUB_TEST_OUT and exits STUB_TEST_RC; a retry (--dir <d> run test <file>) fails when its file name
# contains STUB_RETRY_FAIL; turbo lint exits STUB_LINT_RC; everything else (typecheck, prettier) passes.
echo "$*" >>"$STUB_LOG"
case "$*" in
  "exec turbo run test "*) cat "$STUB_TEST_OUT"; exit "${STUB_TEST_RC:-1}" ;;
  "exec turbo run lint "*) exit "${STUB_LINT_RC:-0}" ;;
  "--dir "*" run test "*) [[ -z "${STUB_RETRY_FAIL:-}" || "$*" != *"$STUB_RETRY_FAIL"* ]]; exit $? ;;
  *) exit 0 ;;
esac
STUB
chmod +x "$tmp/bin/pnpm"
export PATH=$tmp/bin:$PATH

repo=$tmp/repo
mkdir -p "$repo/scripts/lib" "$repo/apps/web/src" "$repo/apps/api/src"
cp "$here/check.sh" "$repo/scripts/check.sh"; cp "$here/lib/result.sh" "$repo/scripts/lib/result.sh"
echo '{"name":"web"}' >"$repo/apps/web/package.json"; echo '{"name":"api"}' >"$repo/apps/api/package.json"
echo '{"name":"root","scripts":{}}' >"$repo/package.json"; : >"$repo/pnpm-lock.yaml"
git -C "$repo" init -q -b main && git -C "$repo" config core.hooksPath /dev/null
git -C "$repo" add -A && git -C "$repo" commit -q -m base
git -C "$repo" update-ref refs/remotes/origin/main HEAD
git -C "$repo" checkout -q -b feat/9-a-b
echo x >"$repo/apps/web/src/a.ts"; echo y >"$repo/apps/api/src/b.ts"
git -C "$repo" add -A && git -C "$repo" commit -q -m change

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" "$tmp/err" "$STUB_LOG" >&2 2>/dev/null || true; exit 1; }
c=$PR_RESULT_DIR/opencv-check-feat-9-a-b.json
check() {  # check [VAR=value ...]: run check.sh --changed with the stub pnpm
  : >"$STUB_LOG"
  set +e; (cd "$repo" && env "$@" scripts/check.sh --changed) >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
}
result() { node "$here/lib/result-check.mjs" "$c" script=check "$@" >/dev/null || fail "result: $(cat "$c")"; }
retries() { grep -c -- '^--dir .* run test ' "$STUB_LOG" || true; }
home=apps/web/src/routes/home-chat.test.tsx
cat "$here/fixtures/check-flaky-home-chat.txt" >"$tmp/one.txt"
cat "$here/fixtures/check-flaky-home-chat.txt" "$here/fixtures/check-flaky-registry-behavior.txt" >"$tmp/two.txt"

# Retry is off by default: a failed test file fails the run and nothing is rerun (and turbo has no --continue).
check STUB_TEST_OUT="$tmp/one.txt"
[[ $code -eq 1 ]] || fail "default: exit $code, want 1"
[[ $(retries) -eq 0 ]] || fail "default: a test was retried"
grep -q -- '--continue' "$STUB_LOG" && fail "default: turbo got --continue"
result status=fail cause=test "files=[\"$home\"]" 'retried=[]'
echo "ok: without CHECK_RETRY_FAILED_TESTS nothing is retried and turbo runs as before"

# A file that passes on its own is a pass with a warning, and is recorded.
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/one.txt"
[[ $code -eq 0 ]] || fail "passes on retry: exit $code, want 0"
grep -q "WARN passed only on retry: $home" "$tmp/out" || fail "passes on retry: no WARN line"
grep -q -- "^--dir apps/web run test src/routes/home-chat.test.tsx\$" "$STUB_LOG" || fail "passes on retry: wrong retry command"
[[ $(retries) -eq 1 ]] || fail "passes on retry: $(retries) retries, want 1"
grep -q -- '^exec turbo run test .*--continue' "$STUB_LOG" || fail "retry mode: turbo test has no --continue"
result status=ok cause=none "retried=[\"$home\"]" 'files=[]'
[[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $c" ]] || fail "RESULT_JSON is not the last line"
echo "ok: a flaky test file (home-chat, pstack-run 20261028T014507Z) passes on retry: WARN, exit 0, recorded in retried"

# Two files, one flaky and one failing again: fails normally, naming only the file that failed twice.
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/two.txt" STUB_RETRY_FAIL=registry/behavior
[[ $code -eq 1 ]] || fail "second failure: exit $code, want 1"
grep -q 'WARN passed only on retry' "$tmp/out" && fail "second failure: WARN printed"
result status=fail cause=test 'files=["apps/api/src/registry/behavior.test.ts"]' 'retried=[]'
[[ $(retries) -eq 2 ]] || fail "second failure: $(retries) retries, want 2 (each file once)"
echo "ok: a file that fails again on its retry fails the run and is the only file named"

# Retry only when test is the one failed task: a lint failure beside it fails at once.
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/one.txt" STUB_LINT_RC=1
[[ $code -eq 1 ]] || fail "lint+test: exit $code"
[[ $(retries) -eq 0 ]] || fail "lint+test: retried"
result status=fail cause=lint
echo "ok: no retry when lint failed too"

# Many failing files is a real break, not a flake.
for i in 1 2 3 4 5 6; do echo "web:test:  FAIL  |shared-modules| src/f$i.test.ts > suite > case"; done >"$tmp/many.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/many.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "many files: exit $code, retries $(retries)"
grep -q 'looks like a real failure' "$tmp/out" || fail "many files: no explanation"
echo "ok: more than 5 failing files are not retried"

# A failure with no named test file (a crash) is not retried.
echo "something broke" >"$tmp/crash.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/crash.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "no file: exit $code, retries $(retries)"
echo "ok: a failure that names no test file is not retried"
echo "all check retry tests passed"
