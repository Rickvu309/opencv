#!/usr/bin/env bash
# test-result.sh: scripts/lib/result.sh (the shared result.json writer) and the result of pnpm check.
# The take, open-pr and merge-pr results are asserted in their own test scripts.
# Fixtures in scripts/fixtures/ are lines from real failing runs (see the names). Usage: scripts/test-result.sh
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE CHECK_DRY_RUN CHECK_BASE_REF PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d "$HOME/tmp/test-result.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv
validate() { node "$here/lib/result-check.mjs" "$@" >/dev/null; }
fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" "$tmp/err" >&2 2>/dev/null || true; exit 1; }
ok() { printf 'ok: %s\n' "$1"; }

# ---- the helper ---------------------------------------------------------------------------------------------------
helper() {  # helper '<bash body>': runs the body in a script that sourced the helper; sets code
  printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\nresult_begin check feat/9-a-b\n%s\n' "$here" "$1" >"$tmp/h.sh"
  set +e; bash "$tmp/h.sh" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
}
last_line_is_path() { [[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $PR_RESULT_DIR/opencv-check-feat-9-a-b.json" ]] || fail "$1: last line is not RESULT_JSON"; }
f=$PR_RESULT_DIR/opencv-check-feat-9-a-b.json

helper 'result_ok "fine" "do nothing"'
[[ $code -eq 0 ]] || fail "success exit"
last_line_is_path success; validate "$f" status=ok cause=none next="do nothing" id=feat-9-a-b repo=opencv blockedBy=null files='[]'
ok "success writes a valid file and prints its path last"

helper 'result_fail test "two \"quoted\" words
on a second line \ and a backslash" "pnpm check test"; result_file "a b/c.test.ts" d.ts; result_retried r.test.ts; result_blocked_by 12 abc123 x.ts y.ts; echo out; exit 1'
[[ $code -eq 1 ]] || fail "failure keeps its exit code"
validate "$f" status=fail cause=test 'files=["a b/c.test.ts","d.ts"]' 'retried=["r.test.ts"]' 'blockedBy={"pr":12,"commit":"abc123","files":["x.ts","y.ts"]}'
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(r.detail!=="two \"quoted\" words on a second line \\ and a backslash") process.exit(1)' "$f" || fail "detail is not escaped"
ok "failure keeps cause, files, retried, blockedBy and escapes the detail"

helper 'result_fail lint first; result_fail test second; exit 1'
validate "$f" cause=lint
ok "the first failure wins"

helper 'false; echo not reached'
[[ $code -eq 1 ]] || fail "crash exit"
validate "$f" status=error cause=other
ok "a crash under set -e writes status error"

helper 'exit 7'
validate "$f" status=error cause=other
grep -q 'code 7' "$f" || fail "exit code is not in the detail"
ok "an exit with no reported result writes status error"

helper 'result_ok fine; exit 3'
validate "$f" status=error
ok "ok followed by a non-zero exit is an error"

for sig in TERM INT HUP; do
  printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\nresult_begin check feat/9-a-b\nresult_ok early\necho started\nsleep 30 &\nwait $!\n' "$here" >"$tmp/h.sh"
  rm -f "$f"
  # A background job starts with SIGINT ignored, which bash cannot trap; restore the default first.
  python3 -I -c 'import os, signal, sys; signal.signal(signal.SIGINT, signal.SIG_DFL); os.execvp("bash", ["bash", sys.argv[1]])' "$tmp/h.sh" >"$tmp/out" 2>"$tmp/err" &
  pid=$!
  for _ in $(seq 100); do grep -q started "$tmp/out" 2>/dev/null && break; sleep 0.05; done
  kill -"$sig" "$pid"
  set +e; wait "$pid"; code=$?; set -e
  pkill -P "$pid" 2>/dev/null || true
  [[ $code -ne 0 ]] || fail "SIG$sig: a killed script exited 0"
  validate "$f" status=error cause=other
  grep -q "SIG$sig" "$f" || fail "SIG$sig: the signal is not in the detail"
done
ok "a script killed by SIGTERM, SIGINT or SIGHUP writes status error and keeps a non-zero exit"

# result_adopt takes a nested script's file only when that run started no earlier than this one.
mkdir -p "$PR_RESULT_DIR"
nested=$PR_RESULT_DIR/nested.json
printf '{"cause":"lint","detail":"old run","next":"n","log":"l","files":["a.ts"],"startedAt":"2000-01-01T00:00:00Z"}\n' >"$nested"
helper "if result_adopt '$nested'; then echo adopted; fi; result_ok mine"
grep -q '^adopted$' "$tmp/out" && fail "result_adopt took a file from an earlier run"
validate "$f" status=ok detail=mine
printf '{"cause":"lint","detail":"new run","next":"n","log":"l","files":["a.ts"],"startedAt":"2999-01-01T00:00:00Z"}\n' >"$nested"
helper "result_adopt '$nested'"
validate "$f" status=fail cause=lint detail="new run" 'files=["a.ts"]'
rm -f "$nested"
ok "result_adopt rejects a leftover result file and takes a fresh one"

: >"$PR_RESULT_DIR/history.jsonl"
helper 'result_ok one'; helper 'result_ok two'
[[ $(grep -c . "$PR_RESULT_DIR/history.jsonl") -eq 2 ]] || fail "history.jsonl has no line per run"
validate "$f" detail=two
ok "history.jsonl keeps every run, the file keeps the last"

printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\nresult_begin check x\nresult_ok done\n' "$here" >"$tmp/h.sh"
touch "$tmp/blocker"
set +e; PR_RESULT_DIR=$tmp/blocker/sub bash "$tmp/h.sh" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
[[ $code -eq 0 ]] || fail "an unwritable result directory changed the exit code"
grep -q '^RESULT_JSON: none' "$tmp/out" || fail "unwritable directory is not reported"
ok "an unwritable result directory is reported and never changes the exit code"

echo "all result helper tests passed"
