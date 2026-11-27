import assert from "node:assert/strict"
import test from "node:test"
import { BODY, PROOF_TREE, fixture } from "./fixture.mjs"

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
  assert.match(text, /\*\*Proof:\*\*/)
  assert.equal(f.effects("gh", "pr edit")[0].args[2], "91")
})

test("body checks citations against the edited pull's head and main", () => {
  const f = fixture({
    intercept(cmd, args) {
      if (
        cmd === "git" &&
        args[0] === "merge-base" &&
        args[1] === "--is-ancestor"
      ) {
        const [, , hash, ref] = args
        const ok =
          (hash === "ab12345" && ref === "head-1") ||
          (hash === "cd23456" && ref === "origin/main")
        return { ok, out: "", err: "" }
      }
      return editOk(cmd, args)
    },
  })
  const note = `${f.ctx.cwd}/note.md`
  f.ctx.writeFile(note, `${BODY}\nMeasured at ab12345 and on cd23456.\n`)
  const accepted = f.call("body", "91", "--body-file", "note.md")
  assert.equal(accepted.code, 0, accepted.text)
  assert.equal(f.effects("gh", "pr edit").length, 1)

  f.ctx.writeFile(note, `${BODY}\nMeasured at \`ef34567\`.\n`)
  const refused = f.call("body", "91", "--body-file", "note.md")
  assert.equal(refused.code, 2, refused.text)
  assert.equal(
    refused.text.split("\n")[0],
    "REFUSED BAD_BODY: Line 6 cites commit ef34567, which is on neither this branch nor origin/main. Measure again at the head or drop the hash."
  )
  assert.equal(f.effects("gh", "pr edit").length, 1)
})

test("body refuses to remove the screenshot section from a screen pull request", () => {
  const f = fixture({
    intercept: editOk,
    changed: ["apps/web/src/features/paper/paper-library-sections.tsx"],
  })
  const note = `${f.ctx.cwd}/note.md`
  f.ctx.writeFile(note, PROOF_TREE)
  const refused = f.call("body", "91", "--body-file", "note.md")
  assert.equal(refused.code, 2, refused.text)
  assert.match(refused.text, /REFUSED NO_BEFORE_AFTER/)
  assert.equal(f.effects("gh", "pr edit").length, 0)

  const picture =
    "![Paper](https://github.com/Rickvu309/opencv/releases/download/screenshots/paper.png)"
  f.ctx.writeFile(note, `${PROOF_TREE}\n## Before / after\n\n${picture}\n`)
  const accepted = f.call("body", "91", "--body-file", "note.md")
  assert.equal(accepted.code, 0, accepted.text)
  assert.ok(uploaded(f).includes(picture))
})

test("body refuses a bad note with the body rule's own message", () => {
  const f = fixture({ intercept: editOk })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, "**Now:** Only this\n")
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: .*\*\*Now:\*\*.*\*\*Proof:\*\*/)
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
    /REFUSED BAD_BODY: .*A fix needs a line: Caught by:.*A fix needs a line: Introduced by:/
  )
  assert.equal(fix.effects("gh", "pr edit").length, 0)

  const introduced = fixture({
    pull: { title: "hotfix: stop it (#90)", body: "Closes #90\n" },
    intercept: editOk,
  })
  introduced.ctx.writeFile(
    `${introduced.ctx.cwd}/note.md`,
    `${PROOF_TREE}\nCaught by: ci\n`
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

test("body counts the closing line it adds to the published body", () => {
  const f = fixture({ intercept: editOk })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, `${BODY}\n${"Visible.\n".repeat(23)}`)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /at most 25 non-empty lines/)
  assert.equal(f.effects("gh", "pr edit").length, 0)
})

test("body refuses to remove Risk from a migration pull request", () => {
  const f = fixture({
    intercept: editOk,
    changed: ["apps/api/drizzle/new.sql"],
    headFiles: {
      "apps/api/drizzle/new.sql": 'CREATE TABLE "opencv_app"."new" (id int)',
    },
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED BAD_BODY: .*migration needs a \*\*Risk:\*\*/)
  assert.equal(f.effects("gh", "pr edit").length, 0)
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

test("body takes the issue from the branch when the current body names another", () => {
  const f = fixture({
    pull: {
      title: "feat: Keep my search (#90)",
      body: "Closes #999\n",
      headRefName: "feat/90-keep-my-search",
    },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.ok(text.startsWith("Closes #90\n\n"))
  assert.equal(text.match(/Closes #90/g).length, 1)
  assert.doesNotMatch(text, /Closes #999/)
})

test("body refuses when the title names a different issue than the branch", () => {
  const f = fixture({
    pull: {
      title: "chore: keep the line (#1072)",
      body: "Closes #1072\n",
      headRefName: "chore/1027-keep-closing-line",
    },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /REFUSED PR_METADATA/)
  assert.match(r.text, /\(#1027\)/)
  assert.equal(f.effects("gh", "pr edit").length, 0)
})

test("body refuses a branch that does not name an issue", () => {
  const f = fixture({
    pull: {
      title: "feat: Keep my search (#90)",
      body: "Closes #90\n",
      headRefName: "wip",
    },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, BODY)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 1, r.text)
  assert.match(r.text, /type\/<issue>-words/)
  assert.equal(f.effects("gh", "pr edit").length, 0)
})

test("a closing line for a longer issue number does not count as this issue", () => {
  const note = `${BODY}\n\nCloses #1027\n`
  const f = fixture({
    pull: {
      title: "feat: keep it (#102)",
      body: note,
      headRefName: "feat/102-keep-it",
    },
    intercept: editOk,
  })
  f.ctx.writeFile(`${f.ctx.cwd}/note.md`, note)
  const r = f.call("body", "91", "--body-file", "note.md")
  assert.equal(r.code, 0, r.text)
  const text = uploaded(f)
  assert.ok(text.startsWith("Closes #102\n\n"))
  assert.match(text, /Closes #1027/)
  assert.equal(text.match(/Closes #102\b/g).length, 1)
})

test("a fix note with both provenance lines is saved once", () => {
  const note = `${PROOF_TREE}\nCaught by: review\nIntroduced by: abc1234\n`
  const f = fixture({
    pull: {
      title: "fix: keep the photo (#90)",
      body: "Closes #90\n",
      headRefName: "fix/90-keep-the-photo",
    },
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
