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

function run(t, pushExit, quiet = false) {
  const scratch = join(homedir(), "tmp")
  mkdirSync(scratch, { recursive: true })
  const root = mkdtempSync(join(scratch, "open-pr-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "bin"))
  mkdirSync(join(root, "scripts"))
  const executable = (path, text) =>
    writeFileSync(join(root, path), text, { mode: 0o755 })
  executable("scripts/check.sh", "#!/bin/sh\nexit 0\n")
  executable(
    "bin/git",
    `#!/bin/sh
case "$1" in
  rev-parse) printf '%s\\n' "$PROOF_ROOT" ;;
  symbolic-ref) echo fix/999-push-failure-proof ;;
  status) exit 0 ;;
  rev-list) echo local-new-commit ;;
  push)
    for arg in "$@"; do
      [ "$arg" != --no-verify ] || { echo "hook bypass forbidden" >&2; exit 97; }
    done
    printf 'push skip=%s\\n' "\${SKIP_CHECKS-unset}" >> "$PROOF_ROOT/events"
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
  'pr create') echo create >> "$PROOF_ROOT/events"; echo https://github.com/o/r/pull/77 ;;
  *) echo "unexpected gh call $*" >&2; exit 99 ;;
esac
`
  )
  const env = {
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    PROOF_ROOT: root,
    PROOF_PUSH_EXIT: String(pushExit),
    PROOF_QUIET: quiet ? "1" : "0",
    PR_RESULT_DIR: join(root, "results"),
    PR_RESULT_REPO: "opencv",
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
  return { ...result, root, events: readFileSync(join(root, "events"), "utf8") }
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

test("successful push with no output still creates a PR", (t) => {
  const result = run(t, 0, true)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.events, "push skip=unset\ncreate\n")
})
