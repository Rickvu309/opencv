#!/usr/bin/env bash
# test-disk-preflight.sh: scripts/lib/disk.sh. The recorded failure is "Disk quota exceeded" on the Claude temp dir
# under /tmp (workflow study report-D, session f419dfed; 85 results in 6 sessions, e.g.
# "/bin/bash: line 2: pwd: write error: Disk quota exceeded"), which the session then dodged with TMPDIR=~/.cache/ad-tmp.
# It is reproduced with TMPDIR unset and a dd that fails only for files under /tmp. The 1 GiB free case is a filesystem
# below the limit, not a recorded state. df and dd are stubbed; no disk is filled.
# The take and open-pr.sh runs are in take.test.mjs and open-pr.test.mjs. Usage: scripts/test-disk-preflight.sh
set -euo pipefail
unset PR_RESULT_ID

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/tmp"
tmp=$(mktemp -d -p "$HOME/tmp" disk-test.XXXXXX)
trap 'rm -rf "$tmp"' EXIT
export PR_RESULT_DIR=$tmp/results PR_RESULT_REPO=opencv HOME=$tmp/home TMPDIR=$tmp/tmpdir
mkdir -p "$HOME/tmp" "$TMPDIR" "$tmp/main" "$tmp/main.worktrees"

mkdir "$tmp/stub-df" "$tmp/stub-dd" "$tmp/stub-dd-tmp"
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
# Fails only for a probe file directly under /tmp, like a quota on the tmpfs.
cat >"$tmp/stub-dd-tmp/dd" <<'STUB'
#!/usr/bin/env bash
for a in "$@"; do [[ "$a" == of=/tmp/* ]] && { echo "dd: error writing '${a#of=}': Disk quota exceeded" >&2; exit 1; }; done
exec /bin/dd "$@"
STUB
chmod +x "$tmp/stub-df/df" "$tmp/stub-dd/dd" "$tmp/stub-dd-tmp/dd"

fail() { printf 'FAIL %s\n' "$1" >&2; cat "$tmp/out" "$tmp/err" >&2 2>/dev/null || true; exit 1; }
guard() {  # guard [VAR=value ...]: run disk_guard in a script of its own
  printf '#!/usr/bin/env bash\nset -euo pipefail\n. "%s/lib/result.sh"\n. "%s/lib/disk.sh"\nresult_begin new-task chore-1\ndisk_guard "${DT_MAIN:-%s/main}" "${DT_MAIN:-%s/main}.worktrees" ${DT_EXTRA:+"$DT_EXTRA"}\nresult_ok started\n' \
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
grep -q 'only 1024 MiB free' "$r" && grep -q 'du -sh' "$r" && grep -q 'scripts/ocv-tools.mjs cleanup' "$r" || fail "low space: detail or next"
grep -q 'ocv-tools.mjs cleanup <issue#>' "$tmp/err" || fail "low space: stderr does not name the cleanup command"
[[ "$(tail -n1 "$tmp/out")" == "RESULT_JSON: $r" ]] || fail "low space: RESULT_JSON is not the last line"
echo "ok: 1 GiB free fails with cause disk and the cleanup commands"

guard "PATH=$tmp/stub-dd:$PATH"
[[ $code -eq 1 ]] || fail "quota: exit $code, want 1"
node "$here/lib/result-check.mjs" "$r" status=fail cause=disk >/dev/null || fail "quota: result"
grep -q 'Disk quota exceeded' "$r" || fail "quota: detail does not say Disk quota exceeded"
echo "ok: 'Disk quota exceeded' on write fails with cause disk"

# The recorded case: TMPDIR unset, so tools write to /tmp, and /tmp is over quota.
guard -u TMPDIR PR_DISK_MIN_MB=1 PR_TMP_MIN_MB=1 "PATH=$tmp/stub-dd-tmp:$PATH"
[[ $code -eq 1 ]] || fail "quota on /tmp with TMPDIR unset: exit $code, want 1"
node "$here/lib/result-check.mjs" "$r" status=fail cause=disk >/dev/null || fail "quota on /tmp: result"
grep -q 'cannot write in /tmp: .*Disk quota exceeded' "$r" || fail "quota on /tmp: detail does not name /tmp"
grep -q "du -sh /tmp/\*" "$r" || fail "quota on /tmp: next does not list /tmp"
echo "ok: TMPDIR unset and /tmp over quota fails with cause disk and a next that lists /tmp"

guard PR_DISK_MIN_MB=1 PR_TMP_MIN_MB=1 TMPDIR= "PATH=$tmp/stub-dd-tmp:$PATH"
[[ $code -eq 1 ]] || fail "TMPDIR empty and /tmp over quota: exit $code, want 1"
echo "ok: an empty TMPDIR counts as unset"

guard -u TMPDIR PR_DISK_MIN_MB=1 PR_TMP_MIN_MB=999999999
[[ $code -eq 1 ]] || fail "tmp threshold: exit $code, want 1"
grep -q 'on the filesystem of /tmp' "$r" || fail "tmp threshold: detail does not name /tmp"
echo "ok: the temp dir has its own threshold, PR_TMP_MIN_MB"

guard -u TMPDIR PR_DISK_MIN_MB=1 PR_TMP_MIN_MB=1
[[ $code -eq 0 ]] || fail "enough room in /tmp: exit $code"
echo "ok: a writable /tmp with room passes"

for bad in 2G abc -5 "1 2" 09 010; do
  guard "PR_DISK_MIN_MB=$bad"
  [[ $code -eq 1 ]] || fail "PR_DISK_MIN_MB='$bad': exit $code, want 1"
  node "$here/lib/result-check.mjs" "$r" status=fail cause=env >/dev/null || fail "PR_DISK_MIN_MB='$bad': cause is not env"
  grep -q 'PR_DISK_MIN_MB must be a whole number' "$r" || fail "PR_DISK_MIN_MB='$bad': detail"
done
guard PR_TMP_MIN_MB=1G
[[ $code -eq 1 ]] || fail "PR_TMP_MIN_MB=1G: exit $code, want 1"
node "$here/lib/result-check.mjs" "$r" status=fail cause=env >/dev/null || fail "PR_TMP_MIN_MB=1G: cause is not env"
echo "ok: a threshold that is not a whole number fails with cause env"

if [[ "$(id -u)" != 0 ]]; then
  mkdir "$tmp/ro" "$tmp/m" "$tmp/m b"; chmod 555 "$tmp/ro" "$tmp/m"
  guard PR_DISK_MIN_MB=1 "DT_EXTRA=$tmp/ro"
  [[ $code -eq 1 ]] || fail "unwritable dir: exit $code, want 1"
  node "$here/lib/result-check.mjs" "$r" status=fail cause=env >/dev/null || fail "unwritable dir: cause is not env"
  node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).next===null?0:1)' "$r" || fail "unwritable dir: next is not null"
  echo "ok: a directory that cannot be written for another reason fails with cause env, not disk"

  guard PR_DISK_MIN_MB=1 "DT_MAIN=$tmp/m b" "DT_EXTRA=$tmp/m"
  [[ $code -eq 1 ]] || fail "dir whose name starts like a checked dir: exit $code, want 1 (it was skipped)"
  echo "ok: a path with a space does not hide another directory from the check"
  chmod 755 "$tmp/ro" "$tmp/m"
fi

mkdir "$tmp/it's main"
guard PR_DISK_MIN_MB=999999999 "DT_MAIN=$tmp/it's main"
[[ $code -eq 1 ]] || fail "quote in path: exit $code, want 1"
node -e '
const next = JSON.parse(require("fs").readFileSync(process.argv[1])).next
const r = require("child_process").spawnSync("bash", ["-n", "-c", next])
process.exit(r.status)' "$r" || fail "next with a quote in the path is not valid shell"
grep -q "it's main" "$r" || fail "next does not name the path"
echo "ok: next stays valid shell when a path holds a quote"

rm -rf "$tmp/main" "$tmp/main.worktrees"; mkdir "$tmp/main" "$tmp/main.worktrees"

rmdir "$tmp/main.worktrees"; rm -rf "$HOME/tmp"
guard PR_DISK_MIN_MB=1
[[ $code -eq 0 ]] || fail "missing dirs are skipped: exit $code"
echo "ok: a directory that does not exist is skipped"

guard PR_DISK_MIN_MB=999999999
[[ $code -eq 1 ]] || fail "threshold: exit $code, want 1"
echo "ok: PR_DISK_MIN_MB sets the threshold"
echo "all disk preflight tests passed"
