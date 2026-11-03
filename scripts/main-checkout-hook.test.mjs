import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, realpathSync, writeFileSync } from "node:fs"
import path from "node:path"
import test, { after, before } from "node:test"
import { fileURLToPath } from "node:url"
import { bashTargets } from "../.claude/hooks/refuse-main-checkout-edit.mjs"
import { makeTempDir, removeTempDir } from "./lib/temp-dir.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const HOOK = path.join(root, ".claude/hooks/refuse-main-checkout-edit.mjs")
const GIT_TIMEOUT_MS = 30_000
const HOOK_TIMEOUT_MS = 30_000

let sandbox
let main
let worktree
let outside

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"],
  })

before(() => {
  sandbox = realpathSync(makeTempDir("main-checkout-hook-"))
  main = path.join(sandbox, "opencv")
  worktree = path.join(sandbox, "opencv.worktrees", "968-example")
  outside = path.join(sandbox, "elsewhere")
  git(sandbox, "init", "--quiet", main)
  git(main, "config", "user.name", "fixture")
  git(main, "config", "user.email", "fixture@example.invalid")
  writeFileSync(path.join(main, "file.txt"), "one\n")
  git(main, "add", "file.txt")
  const tree = git(main, "write-tree").trim()
  const commit = git(main, "commit-tree", tree, "-m", "fixture").trim()
  git(main, "update-ref", "HEAD", commit)
  git(main, "worktree", "add", "--quiet", "-b", "chore/968-example", worktree)
})

after(() => removeTempDir(sandbox))

function runHook(input) {
  const result = spawnSync("node", [HOOK], {
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: HOOK_TIMEOUT_MS,
  })
  return { code: result.status, stderr: result.stderr }
}

const edit = (tool, file, cwd) => ({
  tool_name: tool,
  cwd,
  tool_input:
    tool === "NotebookEdit" ? { notebook_path: file } : { file_path: file },
})
const bash = (command, cwd) => ({
  tool_name: "Bash",
  cwd,
  tool_input: { command },
})

test("an edit of a file inside the main checkout is refused with the rule and the fix", () => {
  for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit"]) {
    const result = runHook(edit(tool, path.join(main, "src/new-file.ts"), main))
    assert.equal(result.code, 2, tool)
    assert.match(result.stderr, /main checkout/)
    assert.match(result.stderr, /scripts\/ocv-tools\.mjs take <issue#>/)
    assert.match(result.stderr, /worktree/)
  }
})

test("a relative path from a session in the main checkout is refused", () => {
  assert.equal(runHook(edit("Edit", "file.txt", main)).code, 2)
})

test("an edit inside a worktree is allowed, from the worktree or from the main checkout", () => {
  const file = path.join(worktree, "src/new-file.ts")
  assert.equal(runHook(edit("Write", file, worktree)).code, 0)
  assert.equal(runHook(edit("Write", file, main)).code, 0)
  assert.equal(runHook(edit("Edit", "file.txt", worktree)).code, 0)
})

test("an edit outside the repository is allowed", () => {
  const file = path.join(outside, "notes.md")
  assert.equal(runHook(edit("Write", file, main)).code, 0)
  assert.equal(runHook(edit("Write", file, worktree)).code, 0)
  assert.equal(runHook(edit("Write", file, sandbox)).code, 0)
})

test("a session with no repository and unreadable input are allowed", () => {
  assert.equal(runHook(edit("Write", path.join(main, "x.ts"), outside)).code, 0)
  const result = spawnSync("node", [HOOK], {
    input: "not json",
    encoding: "utf8",
    timeout: HOOK_TIMEOUT_MS,
  })
  assert.equal(result.status, 0)
})

test("a tool that does not write is allowed", () => {
  const input = {
    tool_name: "Read",
    cwd: main,
    tool_input: { file_path: path.join(main, "file.txt") },
  }
  assert.equal(runHook(input).code, 0)
})

test("a shell command that writes into the main checkout is refused", () => {
  const target = path.join(main, "file.txt")
  for (const command of [
    `sed -i 's/one/two/' ${target}`,
    `sed -n -i -e 's/one/two/' ${target}`,
    `echo hi > ${target}`,
    `echo hi >> "${target}"`,
    `printf x | tee ${target}`,
    `cp ${path.join(worktree, "a")} ${target}`,
    `mv /tmp/a ${target}`,
    `mv -t ${main} /tmp/a`,
  ])
    assert.equal(runHook(bash(command, worktree)).code, 2, command)
  assert.equal(runHook(bash("echo hi > file.txt", main)).code, 2)
  assert.equal(runHook(bash("sed -i 's/a/b/' file.txt", main)).code, 2)
})

test("a shell command that reads, or writes elsewhere, is allowed", () => {
  const target = path.join(main, "file.txt")
  for (const command of [
    `cat ${target}`,
    `grep one ${target} > ${path.join(outside, "out.txt")}`,
    `sed -n 's/one/two/p' ${target}`,
    `echo hi > ${path.join(worktree, "file.txt")}`,
    `cp ${target} ${path.join(worktree, "copy.txt")}`,
    `node run.mjs 2>&1 > /dev/null`,
    `cd ${worktree} && sed -i 's/one/two/' file.txt`,
    `echo $HOME > $FILE`,
    `git -C ${main} status`,
    `cat <<'EOF' > ${path.join(worktree, "note.txt")}\nbody > ${target}\nEOF`,
    `cat > ${path.join(outside, "body.md")} <<'PR-BODY'\n- the hook > the old rule\nPR-BODY`,
    `cat > ${path.join(outside, "body.md")} <<"EOF"\n- the hook > the old rule\nEOF`,
    `cat > ${path.join(outside, "body.md")} <<-X\n- the hook > the old rule\nX`,
    `cat > ${path.join(outside, "body.md")} <<'END.md'\n- the hook > the old rule\nEND.md`,
  ])
    assert.equal(runHook(bash(command, main)).code, 0, command)
})

test("the local settings file in the main checkout is allowed, the tracked settings are not", () => {
  const local = path.join(main, ".claude", "settings.local.json")
  const tracked = path.join(main, ".claude", "settings.json")
  assert.equal(runHook(edit("Write", local, main)).code, 0)
  assert.equal(runHook(bash(`echo {} > ${local}`, main)).code, 0)
  assert.equal(runHook(edit("Write", tracked, main)).code, 2)
  assert.equal(runHook(edit("Write", `${local}.bak`, main)).code, 2)
})

test("the shell reader finds the written files and nothing else", () => {
  assert.deepEqual(bashTargets("echo a > /x/one; tee /x/two < /x/in"), [
    "/x/one",
    "/x/two",
  ])
  assert.deepEqual(bashTargets("sed -i -e 's/a/b/' /x/f /x/g"), [
    "/x/f",
    "/x/g",
  ])
  assert.deepEqual(bashTargets("sed -i 's/a/b/' /x/f"), ["/x/f"])
  assert.deepEqual(bashTargets("cp -r /x/a /x/b /y/dir"), ["/y/dir"])
  assert.deepEqual(bashTargets("ls -la && cat /x/f | wc -l"), [])
  assert.deepEqual(bashTargets("echo 'a > /x/f'"), [])
  assert.deepEqual(
    bashTargets("cd /y && echo a > rel.txt && echo b > /x/abs.txt"),
    ["/x/abs.txt"]
  )
})

test("the project settings register the hook for every edit tool and the shell, from any worktree", () => {
  const settings = JSON.parse(
    readFileSync(path.join(root, ".claude/settings.json"), "utf8")
  )
  const entries = settings.hooks.PreToolUse.filter((entry) =>
    entry.hooks.some((hook) =>
      hook.command.includes("refuse-main-checkout-edit.mjs")
    )
  )
  assert.equal(entries.length, 1)
  const tools = entries[0].matcher.split("|")
  for (const tool of ["Edit", "Write", "MultiEdit", "NotebookEdit", "Bash"])
    assert.ok(tools.includes(tool), tool)
  assert.match(entries[0].hooks[0].command, /\$CLAUDE_PROJECT_DIR/)
})
