import assert from "node:assert/strict"
import test from "node:test"
import { BODY, fixture } from "./fixture.mjs"

const editOk = (cmd, args) => {
  if (cmd === "gh" && args[0] === "pr" && args[1] === "edit")
    return { ok: true, out: "", err: "" }
}

function uploaded(f) {
  const effect = f.effects("gh", "pr edit")[0]
  assert.ok(effect, "gh pr edit was not called")
  const file = effect.args[effect.args.indexOf("--body-file") + 1]
  return f.ctx.readFile(file)
}

test("body keeps the closing line when the new note lacks it", () => {
  const f = fixture({ intercept: editOk })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.equal(text.match(/Closes #90/g).length, 1)
  assert.ok(text.startsWith("Closes #90\n\n"))
  assert.match(text, /## Evidence/)
  assert.equal(f.effects("gh", "pr edit")[0].args[2], "91")
})

test("body refuses a bad note with the body rule's own message", () => {
  const f = fixture({ intercept: editOk })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, "## Summary\n\nOnly this\n")
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: The PR body needs ## Evidence\./)
  assert.equal(f.effects("gh", "pr edit").length, 0)

  const fix = fixture({
    pull: { title: "fix: keep the photo (#90)", body: "Closes #90\n" },
    intercept: editOk,
  })
  fix.ctx.writeFile(`${fix.ctx.cwd}/note.md`, BODY)
  const missingCaught = fix.call("body", "91", "--body-file", "note.md")
  assert.equal(missingCaught.code, 2, missingCaught.text)
  assert.match(
    missingCaught.text,
    /REFUSED BAD_BODY: A fix needs a line: Caught by:/
  )
  assert.equal(fix.effects("gh", "pr edit").length, 0)

  const introduced = fixture({
    pull: { title: "hotfix: stop it (#90)", body: "Closes #90\n" },
    intercept: editOk,
  })
  introduced.ctx.writeFile(
    `${introduced.ctx.cwd}/note.md`,
    `${BODY}\nCaught by: ci\n`
  )
  const missingIntroduced = introduced.call(
    "body",
    "91",
    "--body-file",
    "note.md"
  )
  assert.equal(missingIntroduced.code, 2, missingIntroduced.text)
  assert.match(
    missingIntroduced.text,
    /REFUSED BAD_BODY: A fix needs a line: Introduced by:/
  )
  assert.equal(introduced.effects("gh", "pr edit").length, 0)
})

test("body does not add a second closing line", () => {
  const note = `Closes #90\n\n${BODY}`
  const f = fixture({ intercept: editOk })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, note)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.equal(text, note)
  assert.equal(text.match(/Closes #90/g).length, 1)
})

test("body takes the issue from the existing note when the title has none", () => {
  const f = fixture({
    pull: { title: "feat: Keep my search", body: "Closes #44\n" },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.ok(text.startsWith("Closes #44\n\n"))
  assert.equal(text.match(/Closes #44/g).length, 1)
})

test("a fix note with both provenance lines is saved once", () => {
  const note = `${BODY}\nCaught by: review\nIntroduced by: abc1234\n`
  const f = fixture({
    pull: { title: "fix: keep the photo (#90)", body: "Closes #90\n" },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, note)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.equal(text.match(/Closes #90/g).length, 1)
  assert.match(text, /Caught by: review/)
  assert.match(text, /Introduced by: abc1234/)
})

test("help lists body", () => {
  const { text } = fixture().call("help")
  assert.match(text, /body <pr> --body-file <file>/)
  assert.match(text, /instead of gh pr edit --body-file/)
})
