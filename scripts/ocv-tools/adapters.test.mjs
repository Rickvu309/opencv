import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { EXAMPLES } from "./issue.mjs"
import { ctxFor, fakePorts, issue } from "./ports/fake.mjs"
import { childEnv, realRunner } from "./ports/proc.mjs"

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

test("file --dry-run reads the model issues from the filesystem port", () => {
  const custom = "# feat: Custom model title\n\n### Type\n\nfeat\n"
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

test("a fake comment edit fails like GitHub when the id is gone", () => {
  const ports = fakePorts({ issues: [issue(1)] })
  assert.throws(
    () => ports.gh.editComment(999, "body"),
    /gh api --include failed: comment 999 was not found/
  )
  const row = {
    databaseId: 5,
    body: "old",
    author: { login: "o" },
    createdAt: "",
    updatedAt: "",
  }
  ports.state.issues.get(1).comments.push(row)
  ports.state.commentEditError = "gh api --include failed: HTTP 500"
  assert.throws(() => ports.gh.editComment(5, "new"), /HTTP 500/)
  assert.equal(row.body, "old")
  ports.state.commentEditError = null
  ports.gh.editComment(5, "new")
  assert.equal(row.lastEditedAt, ports.state.commentUpdatedAt)
})
