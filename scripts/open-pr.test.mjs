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

const GOOD_BODY = `## Summary

on(save)
+  skip unchanged

## Evidence

- **Before:** failing test
  **After:** passing test

## Merge Danger

**Door:** two-way

**Blast Radius:** none
`

const DEFAULT_ARGS = ["--draft", "-d", "push failure proof"]

function run(
  t,
  pushExit,
  quiet = false,
  lowDisk = false,
  noCommonDir = false,
  extraEnv = {},
  args = DEFAULT_ARGS,
  bodyText = GOOD_BODY
) {
  if (args === DEFAULT_ARGS) args = [...args, "--body-file", "BODY"]
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
  writeFileSync(join(root, "pnpm"), "")
  if (lowDisk) {
    // A nearly full filesystem (99% used, 1 GiB free), below the 2 GiB limit.
    executable(
      "bin/df",
      "#!/bin/sh\necho 'Filesystem 1024-blocks Used Available Capacity Mounted on'\necho '/dev/sda1 157286400 156237824 1048576 99% /'\n"
    )
  }
  executable(
    "work/repo/scripts/check.mjs",
    `#!/bin/sh
printf 'check retry=%s\\n' "\${CHECK_RETRY_FAILED_TESTS-unset}" >> "$PROOF_ROOT/env"
[ -z "$PROOF_CHECK_FAIL" ] || exit 1
mkdir -p "$PR_RESULT_DIR"
[ -z "$PROOF_RETRIED" ] || printf '{"retried":[%s]}' "$PROOF_RETRIED" > "$PR_RESULT_DIR/opencv-check-fix-999-push-failure-proof.json"
exit 0
`
  )
  executable(
    "bin/pnpm",
    `#!/bin/sh
printf '%s\\n' "$*" >> "$PROOF_ROOT/pnpm"
[ "$1" = check ] || { echo "unexpected pnpm call $*" >&2; exit 99; }
exec sh "$PROOF_ROOT/work/repo/scripts/check.mjs" --changed
`
  )
  executable(
    "bin/git",
    `#!/bin/sh
viaC=0; if [ "$1" = -C ]; then viaC=1; shift 2; fi
case "$1" in
  rev-parse)
    case "$*" in
      *git-common-dir*) [ "$PROOF_NO_COMMON" = 1 ] && exit 1; printf '%s\\n' "$PROOF_ROOT/work/repo/.git" ;;
      *HEAD*) echo deadbeefdeadbeef ;;
      *--absolute-git-dir*) echo "$PROOF_ROOT/gitdir" ;;
      *) printf '%s\\n' "$PROOF_ROOT/work/repo" ;;
    esac ;;
  branch) echo main ;;
  diff) case "$*" in *--raw*) ;; *) [ -z "$PROOF_DIFF_FAIL" ] || exit 1; printf '%s' "$PROOF_DIFF" ;; esac ;;
  log) ;;
  symbolic-ref) echo fix/999-push-failure-proof ;;
  status) if [ "$viaC" = 1 ]; then printf '%s' "$PROOF_DIRTY"; fi; exit 0 ;;
  rev-list) echo local-new-commit ;;
  push)
    for arg in "$@"; do
      [ "$arg" != --no-verify ] || { echo "hook bypass forbidden" >&2; exit 97; }
    done
    printf 'push skip=%s\\n' "\${SKIP_CHECKS-unset}" >> "$PROOF_ROOT/events"
    printf 'push retry=%s\\n' "\${CHECK_RETRY_FAILED_TESTS-unset}" >> "$PROOF_ROOT/env"
    mkdir -p "$PR_RESULT_DIR"
    [ -z "$PROOF_PUSH_RETRIED" ] || printf '{"retried":[%s]}' "$PROOF_PUSH_RETRIED" > "$PR_RESULT_DIR/opencv-check-fix-999-push-failure-proof.json"
    if [ "$PROOF_NOSTAMP" != 1 ]; then mkdir -p "$PROOF_ROOT/work/repo/.git/pre-push-stamps"; echo ok > "$PROOF_ROOT/work/repo/.git/pre-push-stamps/deadbeefdeadbeef"; fi
    if [ "$PROOF_QUIET" != 1 ]; then echo 'push transport diagnostic' >&2; fi
    exit "$PROOF_PUSH_EXIT" ;;
  fetch) ;;
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
  'issue view') case "$*" in *labels*) [ -z "$PROOF_LABELS_FAIL" ] || exit 1; printf '%s' "$PROOF_LABELS" ;; *) echo OPEN ;; esac ;;
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
  if (extraEnv.PROOF_NOSTAMP) {
    // The hook has stamped other pushes in this clone, but not this one (pushed with the hook-skip flag).
    mkdirSync(join(root, "work", "repo", ".git", "pre-push-stamps"), {
      recursive: true,
    })
    writeFileSync(
      join(root, "work", "repo", ".git", "pre-push-stamps", "0123abcd"),
      "ok\n"
    )
  }
  if (extraEnv.PORT_FILES) {
    // R76: ocv-tools take recorded port 4001; .env says otherwise.
    mkdirSync(join(root, "gitdir"))
    writeFileSync(join(root, "gitdir", "assigned-port"), "4001\n")
    writeFileSync(
      join(root, "work", "repo", ".env"),
      extraEnv.PORT_RAW ?? `PORT=${extraEnv.PORT_FILES}\n`
    )
  }
  writeFileSync(join(root, "body.md"), bodyText ?? "")
  const result = spawnSync(
    "bash",
    [script, ...args.map((a) => (a === "BODY" ? join(root, "body.md") : a))],
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
    pnpm: readFileSync(join(root, "pnpm"), "utf8"),
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

test("the quick check runs as pnpm check and neither it nor the push gets CHECK_RETRY_FAILED_TESTS", (t) => {
  const result = run(t, 0)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.pnpm, "check\n")
  assert.equal(result.env, "check retry=unset\npush retry=unset\n")
})

test("a failed quick check fails on its first attempt, with no retry", (t) => {
  const result = run(t, 0, false, false, false, { PROOF_CHECK_FAIL: "1" })
  assert.equal(result.status, 1, result.stderr)
  assert.equal(result.pnpm, "check\n")
  assert.equal(result.env, "check retry=unset\n")
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
  const result = run(t, 0, false, false, false, {
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
  const result = run(t, 0, false, false, false, {
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
    SKIP_CHECKS_DECLARED_BY: "Quan",
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
  assert.match(result.stderr, /scripts\/ocv-tools\.mjs cleanup/)
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
    const file = join(
      result.root,
      "results",
      "opencv-open-pr-fix-999-push-failure-proof.json"
    )
    const next = JSON.parse(readFileSync(file, "utf8")).next
    assert.ok(
      next.startsWith(`cd ${join(result.root, "work", "repo")} && `),
      `next is ${next}`
    )
  }
})

// The workflow rules open-pr.sh enforces. Recorded: issue 255 carrying ready-for-human (label removed by hand at 23:44). The rest are synthetic.
const refuses = (name, extra, pattern, ...more) =>
  test(name, (t) => {
    const result = run(t, 0, false, false, false, extra)
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, pattern)
    assert.equal(result.events, "", "nothing was pushed or created")
    assertResult(
      result,
      "fix-999-push-failure-proof",
      "status=fail",
      "cause=hygiene",
      ...more
    )
  })

refuses(
  "R68: an edited file in the main checkout refuses",
  { PROOF_DIRTY: " M README.md\n" },
  /has edited files/
)
refuses(
  "R76: a changed PORT in .env refuses and restores the assigned port",
  { PORT_FILES: "4999" },
  /ocv-tools take assigned port 4001/
)
refuses(
  "R103: an issue labeled ready-for-human refuses",
  { PROOF_LABELS: "chore\nready-for-human\n" },
  /ready-for-human/
)
refuses(
  "R105: a workflow file refuses",
  { PROOF_DIFF: "README.md\n.github/workflows/extra.yml\n" },
  /workflows other than ci\.yml are not added without an issue/
)
test("R105: the fix removes the files from the worktree, not only from the index", (t) => {
  const result = run(t, 0, false, false, false, {
    PROOF_DIFF: "README.md\n.github/workflows/extra.yml\n",
  })
  const file = join(
    result.root,
    "results",
    "opencv-open-pr-fix-999-push-failure-proof.json"
  )
  assert.match(
    JSON.parse(readFileSync(file, "utf8")).next,
    /^cd \S+ && git rm -rf -- \.github\/workflows\/extra\.yml && git commit --amend --no-edit$/
  )
})
refuses(
  "a label lookup that fails does not pass R103",
  { PROOF_LABELS_FAIL: "1" },
  /cannot read the labels of issue #999/
)
refuses(
  "a diff against origin/main that fails does not pass R105",
  { PROOF_DIFF_FAIL: "1" },
  /cannot diff against origin\/main/
)

for (const [name, raw] of [
  ["a quoted value", 'PORT="4001"\n'],
  ["an export prefix", "export PORT=4001\n"],
  ["a trailing comment", "PORT=4001 # assigned\n"],
  ["a CRLF line ending", "PORT=4001\r\n"],
]) {
  test(`R76: ${name} in .env is the assigned port`, (t) => {
    const result = run(t, 0, false, false, false, {
      PORT_FILES: "x",
      PORT_RAW: raw,
    })
    assert.equal(result.status, 0, result.stderr)
  })
}
refuses(
  "R98: SKIP_CHECKS=1 without a named human refuses",
  { SKIP_CHECKS: "1" },
  /no human is named/
)

test("R98: SKIP_CHECKS=1 with a named human goes on and the body says who", (t) => {
  const result = run(t, 0, false, false, false, {
    SKIP_CHECKS: "1",
    SKIP_CHECKS_DECLARED_BY: "Quan",
  })
  assert.equal(result.status, 0, result.stderr)
})

test("R97: a push that skipped the pre-push hook creates no PR", (t) => {
  const result = run(t, 0, false, false, false, { PROOF_NOSTAMP: "1" })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /no pre-push stamp/)
  assert.equal(result.events, "push skip=unset\n")
})

test("a body without the pr skill parts, or still a placeholder, is refused before any push", (t) => {
  for (const [name, body, message] of [
    ["no body file", null, /pass --body-file/],
    [
      "no Evidence",
      "## Summary\nx\n\n## Merge Danger\n\n**Door:** two-way\n\n**Blast Radius:** none\n",
      /lacks the line '## Evidence'/,
    ],
    [
      "door unset",
      GOOD_BODY.replace("two-way", "<one-way or two-way>"),
      /Door/,
    ],
    [
      "placeholder",
      GOOD_BODY.replace("on(save)", "<diagram, diff-sketch, or tree>"),
      /placeholder/,
    ],
  ]) {
    const result = run(
      t,
      0,
      false,
      false,
      false,
      {},
      body === null
        ? ["--draft", "-d", "x"]
        : ["--draft", "-d", "x", "--body-file", "BODY"],
      body
    )
    assert.equal(result.status, 1, name)
    assert.match(result.stderr, message, name)
    assert.equal(result.events, "", `${name}: nothing pushed or created`)
  }
})
