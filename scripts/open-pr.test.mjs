import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const script = fileURLToPath(new URL("./open-pr.sh", import.meta.url))
const resultCheck = fileURLToPath(
  new URL("./lib/result-check.mjs", import.meta.url)
)

// The result file the run wrote must pass the schema check plus these key=value expectations.
function assertResult(result, id, ...expects) {
  const file = join(result.root, "results", `opencv-open-pr-${id}.json`)
  const check = spawnSync("node", [resultCheck, file, ...expects], {
    encoding: "utf8",
  })
  assert.equal(check.status, 0, check.stderr)
  assert.equal(
    result.stdout.trimEnd().split("\n").at(-1),
    `RESULT_JSON: ${file}`
  )
}

function run(
  t,
  pushExit,
  quiet = false,
  lowDisk = false,
  noCommonDir = false,
  extraEnv = {}
) {
  const scratch = join(homedir(), "tmp")
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(join(scratch, "open-pr-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "bin"))
  mkdirSync(join(root, "work", "repo", "scripts"), { recursive: true })
  mkdirSync(join(root, "home", "tmp"), { recursive: true })
  mkdirSync(join(root, "tmpdir"))
  const executable = (path, text) =>
    writeFileSync(join(root, path), text, { mode: 0o755 })
  writeFileSync(join(root, "events"), "")
  writeFileSync(join(root, "env"), "")
  if (lowDisk) {
    // A nearly full filesystem (99% used, 1 GiB free), below the 2 GiB limit.
    executable(
      "bin/df",
      "#!/bin/sh\necho 'Filesystem 1024-blocks Used Available Capacity Mounted on'\necho '/dev/sda1 157286400 156237824 1048576 99% /'\n"
    )
  }
  executable(
    "work/repo/scripts/check.sh",
    `#!/bin/sh
printf 'check retry=%s\\n' "\${CHECK_RETRY_FAILED_TESTS-unset}" >> "$PROOF_ROOT/env"
mkdir -p "$PR_RESULT_DIR"
[ -z "$PROOF_RETRIED" ] || printf '{"retried":[%s]}' "$PROOF_RETRIED" > "$PR_RESULT_DIR/opencv-check-fix-999-push-failure-proof.json"
exit 0
`
  )
  executable(
    "bin/git",
    `#!/bin/sh
case "$1" in
  rev-parse)
    case "$*" in
      *git-common-dir*) [ "$PROOF_NO_COMMON" = 1 ] && exit 1; printf '%s\\n' "$PROOF_ROOT/work/repo/.git" ;;
      *) printf '%s\\n' "$PROOF_ROOT/work/repo" ;;
    esac ;;
  symbolic-ref) echo fix/999-push-failure-proof ;;
  status) exit 0 ;;
  rev-list) echo local-new-commit ;;
  push)
    for arg in "$@"; do
      [ "$arg" != --no-verify ] || { echo "hook bypass forbidden" >&2; exit 97; }
    done
    printf 'push skip=%s\\n' "\${SKIP_CHECKS-unset}" >> "$PROOF_ROOT/events"
    printf 'push retry=%s\\n' "\${CHECK_RETRY_FAILED_TESTS-unset}" >> "$PROOF_ROOT/env"
    mkdir -p "$PR_RESULT_DIR"
    [ -z "$PROOF_PUSH_RETRIED" ] || printf '{"retried":[%s]}' "$PROOF_PUSH_RETRIED" > "$PR_RESULT_DIR/opencv-check-fix-999-push-failure-proof.json"
    if [ "$PROOF_QUIET" != 1 ]; then echo 'push transport diagnostic' >&2; fi
    exit "$PROOF_PUSH_EXIT" ;;
  ls-remote) echo 'oldremote refs/heads/fix/999-push-failure-proof' ;;
  *) echo "unexpected git call $*" >&2; exit 99 ;;
esac
`
  )
  executable(
    "bin/gh",
    `#!/bin/sh
case "$1 $2" in
  'auth status'|'pr list') exit 0 ;;
  'issue view') echo OPEN ;;
  'pr create')
    echo create >> "$PROOF_ROOT/events"
    [ "\${PROOF_CREATE_EXIT-0}" = 0 ] || { echo 'create refused' >&2; exit "$PROOF_CREATE_EXIT"; }
    echo https://github.com/o/r/pull/77 ;;
  *) echo "unexpected gh call $*" >&2; exit 99 ;;
esac
`
  )
  const env = {
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    PROOF_ROOT: root,
    PROOF_PUSH_EXIT: String(pushExit),
    PROOF_QUIET: quiet ? "1" : "0",
    PROOF_NO_COMMON: noCommonDir ? "1" : "0",
    HOME: join(root, "home"),
    TMPDIR: join(root, "tmpdir"),
    PR_RESULT_DIR: join(root, "results"),
    PR_RESULT_REPO: "opencv",
    PR_DISK_MIN_MB: lowDisk ? "2048" : "1", // the real disk's free space must not decide a test
    ...extraEnv,
  }
  if (extraEnv.PROOF_OLD_RETRIED) {
    // A check result an earlier run left for this branch.
    mkdirSync(join(root, "results"), { recursive: true })
    writeFileSync(
      join(root, "results", "opencv-check-fix-999-push-failure-proof.json"),
      `{"retried":[${extraEnv.PROOF_OLD_RETRIED}]}`
    )
  }
  const result = spawnSync(
    "bash",
    [script, "--draft", "-d", "push failure proof"],
    {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 10_000,
    }
  )
  assert.ifError(result.error)
  return {
    ...result,
    root,
    events: readFileSync(join(root, "events"), "utf8"),
    env: readFileSync(join(root, "env"), "utf8"),
  }
}

test("failed push with an existing remote branch stops before PR creation", (t) => {
  const result = run(t, 42)
  assert.equal(result.status, 1)
  assert.equal(result.events, "push skip=unset\n")
  assert.match(result.stderr, /push transport diagnostic/)
  assert.match(result.stderr, /push failed; no PR created/)
  assertResult(
    result,
    "fix-999-push-failure-proof",
    "status=fail",
    "cause=other"
  )
})

test("successful push preserves hooks and creates a PR", (t) => {
  const result = run(t, 0)
  assert.equal(result.status, 0, result.stderr)
  assertResult(result, "77", "status=ok", "cause=none")
  assert.equal(result.events, "push skip=unset\ncreate\n")
  assert.match(result.stderr, /push transport diagnostic/)
})

test("the quick check and the push's pre-push check retry a failed test file once, nothing else does", (t) => {
  const result = run(t, 0)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.env, "check retry=1\npush retry=1\n")
})

const retried = '"apps/web/a.test.tsx","apps/api/b.test.ts"'

test("files that passed only on retry are warned about and recorded in result.json", (t) => {
  const result = run(t, 0, false, false, false, { PROOF_RETRIED: retried })
  assert.equal(result.status, 0, result.stderr)
  assert.match(
    result.stdout,
    /^WARN passed only on retry: apps\/web\/a\.test\.tsx apps\/api\/b\.test\.ts$/m
  )
  assertResult(
    result,
    "77",
    "status=ok",
    'retried=["apps/web/a.test.tsx","apps/api/b.test.ts"]'
  )
})

test("the retry WARN is printed even when gh pr create fails", (t) => {
  const result = run(t, 0, false, false, {
    PROOF_RETRIED: retried,
    PROOF_CREATE_EXIT: "1",
  })
  assert.equal(result.status, 1)
  assert.equal(result.events, "push skip=unset\ncreate\n")
  assert.match(
    result.stdout,
    /^WARN passed only on retry: apps\/web\/a\.test\.tsx apps\/api\/b\.test\.ts$/m
  )
  assert.match(result.stderr, /gh pr create failed/)
})

test("files retried by the quick check and by the push's check are all recorded", (t) => {
  const result = run(t, 0, false, false, {
    PROOF_RETRIED: '"apps/web/a.test.tsx"',
    PROOF_PUSH_RETRIED: '"apps/api/b.test.ts"',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(
    result.stdout,
    /^WARN passed only on retry: apps\/web\/a\.test\.tsx apps\/api\/b\.test\.ts$/m
  )
  assertResult(
    result,
    "77",
    "status=ok",
    'retried=["apps/web/a.test.tsx","apps/api/b.test.ts"]'
  )
})

test("with SKIP_CHECKS=1 an old check result's retried list is not adopted", (t) => {
  const result = run(t, 0, false, false, false, {
    SKIP_CHECKS: "1",
    PROOF_OLD_RETRIED: retried,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout, /passed only on retry/)
  assertResult(result, "77", "status=ok", "retried=[]")
})

test("successful push with no output still creates a PR", (t) => {
  const result = run(t, 0, true)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.events, "push skip=unset\ncreate\n")
})

test("a nearly full disk fails with cause disk before the check, push or PR", (t) => {
  const result = run(t, 0, false, true)
  assert.equal(result.status, 1)
  assert.equal(result.events, "")
  assert.match(result.stderr, /disk preflight failed: only 1024 MiB free/)
  assert.match(result.stderr, /scripts\/cleanup-worktree\.sh/)
  assertResult(
    result,
    "fix-999-push-failure-proof",
    "status=fail",
    "cause=disk"
  )
})

test("a disk failure names the main checkout in next, also when git cannot find the common dir", (t) => {
  for (const noCommonDir of [false, true]) {
    const result = run(t, 0, false, true, noCommonDir)
    const file = join(result.root, "results", "opencv-open-pr-fix-999-push-failure-proof.json")
    const next = JSON.parse(readFileSync(file, "utf8")).next
    assert.ok(
      next.startsWith(`cd ${join(result.root, "work", "repo")} && `),
      `next is ${next}`
    )
  }
})
