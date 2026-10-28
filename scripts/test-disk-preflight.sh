#!/usr/bin/env bash
# test-disk-preflight.sh: scripts/lib/disk.sh. The failures are the recorded ones: the root filesystem about 96% full
# (workflow study report-D, session f419dfed) and "write error: Disk quota exceeded" (85 results in 6 sessions,
# e.g. "/bin/bash: line 2: pwd: write error: Disk quota exceeded"). df and dd are stubbed; no disk is filled.
# The new-task.sh and open-pr.sh runs are in test-new-task.sh and open-pr.test.mjs. Usage: scripts/test-disk-preflight.sh
set -euo pipefail
unset PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv HOME=$tmp/home
mkdir -p "$HOME/tmp" "$tmp/main" "$tmp/main.worktrees"

mkdir "$tmp/stub-df" "$tmp/stub-dd"
# 150 GB filesystem, 148 GB used, 1 GiB available: 99% full.
cat >"$tmp/stub-df/df" <<'STUB'
#!/usr/bin/env bash
echo 'Filesystem     1024-blocks      Used Available Capacity Mounted on'
echo '/dev/sda1        157286400 156237824   1048576      99% /'
STUB
cat >"$tmp/stub-dd/dd" <<'STUB'
#!/usr/bin/env bash
echo "dd: error writing '$3': Disk quota exceeded" >&2
exit 1
STUB
chmod +x "$tmp/stub-df/df" "$tmp/stub-dd/dd"

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" "$tmp/err" >&2 2>/dev/null || true; exit 1; }
guard() {  # guard [VAR=value ...]: run disk_guard in a script of its own
  printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/disk.sh"\nresult_begin new-task chore-1\ndisk_guard "%s/main" "%s/main.worktrees"\nresult_ok started\n' \
    "$here" "$here" "$tmp" "$tmp" >"$tmp/g.sh"
  set +e; env "$@" bash "$tmp/g.sh" >"$tmp/out" 2>"$tmp/err"; code=$?; set -e
}
r=$PR_RESULT_DIR/opencv-new-task-chore-1.json

guard PR_DISK_MIN_MB=1
[[ $code -eq 0 ]] || fail "enough room: exit $code"
node "$here/lib/result-check.mjs" "$r" status=ok >/dev/null || fail "enough room: result"
ls -A "$tmp/main" | grep -q . && fail "probe file left behind"
echo "ok: enough room starts the script and leaves no probe file"

guard "PATH=$tmp/stub-df:$PATH"
[[ $code -eq 1 ]] || fail "low space: exit $code, want 1"
node "$here/lib/result-check.mjs" "$r" status=fail cause=disk >/dev/null || fail "low space: result"
grep -q 'only 1024 MiB free' "$r" && grep -q 'du -sh' "$r" && grep -q 'scripts/cleanup-worktree.sh' "$r" || fail "low space: detail or next"
grep -q 'cleanup-worktree.sh <issue#>' "$tmp/err" || fail "low space: stderr does not name the cleanup command"
[[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $r" ]] || fail "low space: RESULT_JSON is not the last line"
echo "ok: 1 GiB free on a 99% full filesystem fails with cause disk and the cleanup commands"

guard "PATH=$tmp/stub-dd:$PATH"
[[ $code -eq 1 ]] || fail "quota: exit $code, want 1"
node "$here/lib/result-check.mjs" "$r" status=fail cause=disk >/dev/null || fail "quota: result"
grep -q 'Disk quota exceeded' "$r" || fail "quota: detail does not say Disk quota exceeded"
echo "ok: 'Disk quota exceeded' on write fails with cause disk"

rmdir "$tmp/main.worktrees"; rm -rf "$HOME/tmp"
guard PR_DISK_MIN_MB=1
[[ $code -eq 0 ]] || fail "missing dirs are skipped: exit $code"
echo "ok: a directory that does not exist is skipped"

guard PR_DISK_MIN_MB=999999999
[[ $code -eq 1 ]] || fail "threshold: exit $code, want 1"
echo "ok: PR_DISK_MIN_MB sets the threshold"
echo "all disk preflight tests passed"
