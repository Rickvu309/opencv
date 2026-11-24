import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { EXAMPLES } from "./issue.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"
import { childEnv, isolatedEnv, realRunner } from "./ports/proc.mjs"

test("child processes cannot open a prompt", () => {
  const git = childEnv("git", {}, { PATH: "/bin" })
  assert.equal(git.GH_PROMPT_DISABLED, "1")
  assert.equal(git.GIT_TERMINAL_PROMPT, "0")
  assert.equal(git.GIT_EDITOR, "true")
  assert.equal(
    childEnv("git", {}, { PATH: "/bin", GIT_EDITOR: "vim" }).GIT_EDITOR,
    "vim"
  )
  assert.equal(childEnv("gh", {}, { PATH: "/bin" }).GIT_EDITOR, undefined)
  const run = realRunner()
  const saw = run(process.execPath, [
    "-e",
    "process.stdout.write(process.env.GH_PROMPT_DISABLED + ' ' + process.env.GIT_TERMINAL_PROMPT)",
  ])
  assert.equal(saw.ok, true, saw.err)
  assert.equal(saw.out, "1 0")
})

const HOOK_ENV = {
  PATH: "/bin",
  HOME: "/home/a",
  DATABASE_URL: "postgres://local",
  NODE_TEST_CONTEXT: "child-v8",
  FORCE_COLOR: "1",
  GIT_DIR: "/repo/.git/worktrees/w",
  GIT_WORK_TREE: "/repo",
  GIT_INDEX_FILE: "/repo/.git/worktrees/w/index",
  GIT_COMMON_DIR: "/repo/.git",
  GIT_OBJECT_DIRECTORY: "/repo/.git/objects",
  GIT_ALTERNATE_OBJECT_DIRECTORIES: "/other/objects",
  GIT_CONFIG: "/repo/.git/config",
  GIT_CONFIG_GLOBAL: "/home/a/.gitconfig",
  GIT_CONFIG_SYSTEM: "/etc/gitconfig",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "core.hooksPath",
  GIT_CONFIG_VALUE_0: "/dev/null",
  GIT_CONFIG_PARAMETERS: "'user.name'='t'",
  GIT_NAMESPACE: "ns",
  GIT_PREFIX: "apps/",
  GIT_CEILING_DIRECTORIES: "/",
  GIT_QUARANTINE_PATH: "/repo/.git/objects/incoming",
  GIT_SSH_COMMAND: "ssh -i key",
}

test("a child that is not git gets no git variable of the hook it runs in, only the allow-listed ones", () => {
  const env = isolatedEnv(HOOK_ENV)
  assert.deepEqual(
    Object.keys(env).filter((name) => name.startsWith("GIT_")),
    ["GIT_SSH_COMMAND"]
  )
  assert.equal(env.NODE_TEST_CONTEXT, undefined)
  assert.equal(env.FORCE_COLOR, undefined)
  assert.equal(env.DATABASE_URL, "postgres://local")
  assert.equal(env.HOME, "/home/a")
  const node = childEnv("node", {}, HOOK_ENV)
  assert.equal(node.GIT_DIR, undefined)
  assert.equal(node.GIT_INDEX_FILE, undefined)
  assert.equal(node.GIT_CONFIG_KEY_0, undefined)
  assert.equal(node.GIT_TERMINAL_PROMPT, "0")
  const git = childEnv("git", {}, HOOK_ENV)
  assert.equal(git.GIT_INDEX_FILE, HOOK_ENV.GIT_INDEX_FILE)
  assert.equal(git.GIT_DIR, HOOK_ENV.GIT_DIR)
})

test("file --dry-run reads the model issues from the filesystem port", () => {
  const custom = JSON.stringify([
    { title: "feat: Custom model title", body: "### Type\n\nfeat\n" },
  ])
  const ports = fakePorts({ files: { [EXAMPLES]: custom } })
  const { code, text } = runCli(
    [
      "file",
      "--title",
      "feat: Keep my search",
      "--what",
      "The page forgets your search. This keeps it.",
      "--done",
      "- I come back and the box still has my words.",
      "--risk",
      "low",
      "--dry-run",
    ],
    ctxFor(ports)
  )
  assert.equal(code, 0, text)
  assert.match(text, /Custom model title/)
  assert.equal(ports.effects.length, 0)
})
