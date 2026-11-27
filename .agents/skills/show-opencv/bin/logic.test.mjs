import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { resolverFor } from "./logic.mjs"

function scratch(t) {
  const root = path.join(homedir(), "tmp")
  mkdirSync(root, { recursive: true })
  const dir = mkdtempSync(path.join(root, "show-opencv-"))
  t.after(() => rmSync(dir, { recursive: true }))
  return dir
}

test("opens a file, a file at a line it has, and an HTTPS reference", (t) => {
  const repo = scratch(t)
  writeFileSync(path.join(repo, "proof.md"), "one\ntwo\nthree\n")
  const resolves = resolverFor(repo)
  for (const ref of [
    "proof.md",
    "proof.md:3",
    "proof.md#outcomes",
    "https://github.com/o/r/pull/1",
  ])
    assert.equal(resolves(ref), true, ref)
  for (const ref of [
    "proof.md:4",
    "absent.md",
    ".",
    "https://?",
    "http://example.test/proof",
  ])
    assert.equal(resolves(ref), false, ref)
})

test("the command writes only tree.md and refuses a reason without evidence or with code in its claim", (t) => {
  const dir = scratch(t)
  const input = path.join(dir, "paper.json")
  const script = fileURLToPath(new URL("logic.mjs", import.meta.url))
  const tree = {
    kind: "assure",
    question: "What appears on a Paper card?",
    answer: {
      claim: "Each Paper card shows the opening lines",
      group: { axis: "reasons", covers: "the old and new previews" },
      children: [
        {
          claim: "Every card showed an empty sheet",
          evidence: [
            {
              ref: "https://github.com/Rickvu309/opencv/pull/2133",
              source: "Observed",
              verdict: "passed",
            },
          ],
        },
        {
          claim: "Cards now show document text",
          evidence: [
            {
              ref: "https://github.com/Rickvu309/opencv/pull/2133/files",
              source: "Observed",
              verdict: "open",
            },
          ],
        },
      ],
    },
  }
  const run = (name) => {
    writeFileSync(input, JSON.stringify(tree))
    return spawnSync(
      process.execPath,
      [script, input, "--out", path.join(dir, name)],
      { encoding: "utf8" }
    )
  }
  const accepted = run("accepted")
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.deepEqual(JSON.parse(accepted.stdout), {
    verdict: "open",
    file: path.join(dir, "accepted", "tree.md"),
  })
  assert.deepEqual(readdirSync(path.join(dir, "accepted")), ["tree.md"])

  const reason = tree.answer.children[0]
  reason.evidence = []
  const ungrounded = run("ungrounded")
  assert.equal(ungrounded.status, 1, ungrounded.stderr)
  assert.deepEqual(
    JSON.parse(ungrounded.stdout).refusals.map(({ rule, at }) => [rule, at]),
    [["grounded", "A"]]
  )
  reason.evidence = tree.answer.children[1].evidence
  for (const claim of [
    "The card in paper-list.tsx drew an empty sheet",
    "The card used `preview` on every row",
  ]) {
    reason.claim = claim
    const code = run("code")
    assert.equal(code.status, 1, code.stderr)
    assert.deepEqual(
      JSON.parse(code.stdout).refusals.map(({ rule, at }) => [rule, at]),
      [["plain", "A"]]
    )
  }
  assert.deepEqual(readdirSync(dir).sort(), ["accepted", "paper.json"])
})
