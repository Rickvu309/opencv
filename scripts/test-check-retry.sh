#!/usr/bin/env bash
# test-check-retry.sh: the retry-once of scripts/check.sh (CHECK_RETRY_FAILED_TESTS=1, set by open-pr.sh only).
# The failures are real vitest FAIL lines from past runs that passed on the next run (scripts/fixtures/check-flaky-*.txt,
# from pstack-run 20261028T014507Z-nmimjadj and 20261026T205005Z-gzts2402) with turbo's closing "Failed:" line. pnpm is a
# stub that prints them, so no suite runs.
# Usage: scripts/test-check-retry.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN CHECK_BASE_REF CHECK_RETRY_FAILED_TESTS PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d "$HOME/tmp/check-retry-test-XXXXXX")
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv STUB_LOG=$tmp/pnpm.log

mkdir "$tmp/bin"
cat >"$tmp/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
# turbo test prints STUB_TEST_OUT and exits STUB_TEST_RC; a retry (--dir <d> run test <file>) fails when its file name
# contains STUB_RETRY_FAIL; turbo lint exits STUB_LINT_RC; prettier exits STUB_PRETTIER_RC; everything else passes.
echo "$*" >>"$STUB_LOG"
case "$*" in
  "exec turbo run test "*) cat "$STUB_TEST_OUT"; exit "${STUB_TEST_RC:-1}" ;;
  "exec turbo run lint "*) exit "${STUB_LINT_RC:-0}" ;;
  "exec prettier "*) exit "${STUB_PRETTIER_RC:-0}" ;;
  "--dir "*" run test "*) [[ -z "${STUB_RETRY_FAIL:-}" || "$*" != *"$STUB_RETRY_FAIL"* ]]; exit $? ;;
  *) exit 0 ;;
esac
STUB
chmod +x "$tmp/bin/pnpm"
export PATH=$tmp/bin:$PATH

repo=$tmp/repo
mkdir -p "$repo/scripts/lib" "$repo/apps/web/src" "$repo/apps/api/src" "$repo/packages/domain/src"
printf '#!/usr/bin/env bash\nexit "${STUB_CODEOWNERS_RC:-0}"\n' >"$repo/scripts/test-codeowners.sh"; chmod +x "$repo/scripts/test-codeowners.sh"
cp "$here/check.sh" "$repo/scripts/check.sh"; cp "$here/lib/result.sh" "$repo/scripts/lib/result.sh"
echo '{"name":"web"}' >"$repo/apps/web/package.json"; echo '{"name":"api"}' >"$repo/apps/api/package.json"; echo '{"name":"@workspace/domain"}' >"$repo/packages/domain/package.json"
echo '{"name":"root","scripts":{"lint":"turbo lint","test":"node --test scripts/guard.test.mjs"}}' >"$repo/package.json"; : >"$repo/pnpm-lock.yaml"
: >"$repo/scripts/guard.test.mjs"
git -C "$repo" init -q -b main && git -C "$repo" config core.hooksPath /dev/null
git -C "$repo" add -A && git -C "$repo" commit -q -m base
git -C "$repo" update-ref refs/remotes/origin/main HEAD
git -C "$repo" checkout -q -b feat/9-a-b
echo x >"$repo/apps/web/src/a.ts"; echo y >"$repo/apps/api/src/b.ts"; echo z >"$repo/packages/domain/src/c.ts"; echo '# changed' >>"$repo/scripts/test-codeowners.sh"
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
# A turbo run's output: the FAIL lines, then its summary naming the failed packages.
turbo_out() { local out=$1 failed=$2; shift 2; { cat "$@"; printf ' Tasks:    1 successful, 4 total\n Failed:    %s\n' "$failed"; } >"$out"; }
flaky_home=$here/fixtures/check-flaky-home-chat.txt flaky_reg=$here/fixtures/check-flaky-registry-behavior.txt
turbo_out "$tmp/one.txt" web#test "$flaky_home"
turbo_out "$tmp/two.txt" web#test,\ api#test "$flaky_home" "$flaky_reg"

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
echo ' Failed:    web#test' >>"$tmp/many.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/many.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "many files: exit $code, retries $(retries)"
grep -q 'looks like a real failure' "$tmp/out" || fail "many files: no explanation"
echo "ok: more than 5 failing files are not retried"

# A failure with no named test file (a crash) is not retried.
echo "something broke" >"$tmp/crash.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/crash.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "no file: exit $code, retries $(retries)"
echo "ok: a failure that names no test file is not retried"
# A real failure that prints no vitest FAIL line (node:test in packages/domain) beside a flaky file: turbo --continue
# runs both, and the flaky file passes alone: the run must still fail.
turbo_out "$tmp/hidden.txt" web#test,\ @workspace/domain#test "$flaky_home"
printf 'domain:test: not ok 1 - parses a paper\n' >>"$tmp/hidden.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/hidden.txt"
[[ $code -eq 1 ]] || fail "hidden failure: exit $code, want 1"
grep -q 'WARN passed only on retry' "$tmp/out" && fail "hidden failure: WARN printed"
[[ $(retries) -eq 0 ]] || fail "hidden failure: retried"
grep -q 'packages/domain failed without a failed test file' "$tmp/out" || fail "hidden failure: no explanation"
result status=fail cause=test 'retried=[]'
echo "ok: a package that failed with no FAIL line is not hidden by a flaky file elsewhere"

# Vitest unhandled errors exit 1 with no FAIL line for the cause, even inside the package of the flaky file.
turbo_out "$tmp/unhandled.txt" web#test "$flaky_home"
printf 'web:test:  Vitest caught 1 unhandled error during the test run.\nweb:test: ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯\n' >>"$tmp/unhandled.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/unhandled.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "unhandled: exit $code, retries $(retries)"
grep -q 'unhandled error; not retrying' "$tmp/out" || fail "unhandled: no explanation"
echo "ok: an unhandled error in the output blocks the retry"

# The same with a long log after the report (error stacks, DOM dumps, the other package's output): the guard reads the
# whole log, not the first match, so a long tail cannot hide it.
tail_lines() { for i in $(seq 1 "$1"); do printf 'api:test: stdout | line %s of unrelated output that keeps the log long enough to fill a pipe\n' "$i"; done; }
turbo_out "$tmp/unhandled-long.txt" web#test "$flaky_home"
printf 'web:test:  Vitest caught 1 unhandled error during the test run.\nweb:test: ⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯\n' >>"$tmp/unhandled-long.txt"
tail_lines 4000 >>"$tmp/unhandled-long.txt"
(( $(wc -c <"$tmp/unhandled-long.txt") > 300000 )) || fail "long log fixture is too short"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/unhandled-long.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "unhandled long: exit $code, retries $(retries)"
grep -q 'unhandled error; not retrying' "$tmp/out" || fail "unhandled long: no explanation"
echo "ok: an unhandled error followed by a long log still blocks the retry"

# An app log line that says "unhandled error" is not vitest's report: the flaky file is still retried.
turbo_out "$tmp/applog.txt" web#test "$flaky_home"
printf 'api:test: {"level":"error","msg":"unhandled error","error":"Error"}\n' >>"$tmp/applog.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/applog.txt"
[[ $code -eq 0 && $(retries) -eq 1 ]] || fail "app log: exit $code, retries $(retries)"
echo "ok: an app log line saying unhandled error does not block the retry"

# A vitest timeout far from the end of a long log is still a timing test.
turbo_out "$tmp/timeout-long.txt" web#test "$flaky_home"
printf 'web:test: Error: Hook timed out in 10000ms.\n' >>"$tmp/timeout-long.txt"
tail_lines 4000 >>"$tmp/timeout-long.txt"
check STUB_TEST_OUT="$tmp/timeout-long.txt"
[[ $code -eq 1 ]] || fail "timeout long: exit $code, want 1"
result status=fail cause=timing-test
echo "ok: a timeout line followed by a long log is classified as a timing test"

# Without turbo's Failed line the failed packages are unknown, so nothing is retried.
cat "$flaky_home" >"$tmp/nosummary.txt"
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/nosummary.txt"
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "no summary: exit $code, retries $(retries)"
grep -q "turbo's failed packages are not known" "$tmp/out" || fail "no summary: no explanation"
echo "ok: no turbo Failed line, no retry"

# A script test failing beside turbo test is a second failed task: no retry.
check CHECK_RETRY_FAILED_TESTS=1 STUB_TEST_OUT="$tmp/one.txt" STUB_CODEOWNERS_RC=1
[[ $code -eq 1 && $(retries) -eq 0 ]] || fail "script test: exit $code, retries $(retries)"
grep -q 'FAILED: test codeowners-tests' "$tmp/err" || fail "script test: both tasks not reported"
echo "ok: no retry when a scripts/ test failed too"

# A CHECK_RETRY_MAX_FILES that is not a number falls back to 5 instead of aborting.
check CHECK_RETRY_FAILED_TESTS=1 CHECK_RETRY_MAX_FILES=abc STUB_TEST_OUT="$tmp/one.txt"
[[ $code -eq 0 ]] || fail "bad max: exit $code, want 0"
grep -q "WARN passed only on retry: $home" "$tmp/out" || fail "bad max: no WARN line"
echo "ok: a non-numeric CHECK_RETRY_MAX_FILES means 5"
# The full run checks formatting of the whole repo after lint; the quick run only its changed files.
(cd "$repo" && CHECK_DRY_RUN=1 scripts/check.sh lint) >"$tmp/out" 2>&1
grep -q '^\[dry-run\] pnpm exec prettier --check --ignore-unknown -- \.$' "$tmp/out" || fail "full dry run: no whole-repo prettier step"
(cd "$repo" && CHECK_DRY_RUN=1 scripts/check.sh --changed lint) >"$tmp/out" 2>&1
! grep -q -- ' -- \.$' "$tmp/out" || fail "changed dry run: whole-repo prettier step"
echo "ok: full mode runs prettier --check . after lint, --changed does not"

# A prettier failure in the full run fails it with cause lint.
: >"$STUB_LOG"
set +e; (cd "$repo" && STUB_PRETTIER_RC=1 scripts/check.sh lint) >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 1 ]] || fail "full prettier fail: exit $code, want 1"
grep -q 'FAILED: prettier' "$tmp/err" || fail "full prettier fail: prettier not reported"
result status=fail cause=lint
echo "ok: a whole-repo prettier failure fails the full run with cause lint"
echo "all check retry tests passed"
