import assert from "node:assert/strict"
import test from "node:test"
import { shortRef, toMarkdown } from "./page.mjs"
import { readTree } from "./tree.mjs"

test("writes the question, answer verdict, split, and each reason with its evidence", () => {
  const { tree } = readTree(
    {
      kind: "assure",
      question: "Why did every Paper card show an empty sheet?",
      answer: {
        claim: "Paper cards now show the opening lines",
        group: { axis: "reasons", covers: "the cause and the fix" },
        children: [
          {
            claim: "Every card drew the same empty preview",
            evidence: [
              {
                ref: "scripts/library-card-lines.test.mjs:12",
                source: "Observed",
                verdict: "passed",
              },
            ],
          },
          {
            claim: "Each card now uses its own opening lines",
            detail: "People can tell their documents apart.",
            evidence: [
              {
                ref: "https://github.com/Rickvu309/opencv/pull/2133",
                source: "Prototype",
                verdict: "open",
              },
            ],
          },
        ],
      },
    },
    { resolves: () => true }
  )
  assert.equal(
    toMarkdown(tree),
    [
      "*Why did every Paper card show an empty sheet?*",
      "",
      "Verdict: Open",
      "",
      "Split by reasons. Covers the cause and the fix.",
      "",
      "- **A.** Every card drew the same empty preview (Passed)",
      "  - `scripts/library-card-lines.test.mjs:12` (passed)",
      "- **B.** Each card now uses its own opening lines (Open)",
      "",
      "  People can tell their documents apart.",
      "",
      "  - Prototype: [PR 2133](<https://github.com/Rickvu309/opencv/pull/2133>) (open)",
      "",
    ].join("\n")
  )
})

test("formats a chosen option, nested reasons, and evidence without a verdict", () => {
  const { tree } = readTree(
    {
      kind: "decide",
      question: "How should a Paper card preview a document?",
      answer: {
        claim: "Show the opening lines of the document",
        group: { axis: "options", covers: "the previews a card can use" },
        children: [
          {
            claim: "Keep showing an empty preview",
            evidence: [{ ref: "current.md", source: "Observed" }],
          },
          {
            claim: "Show the text of the document",
            chosen: true,
            group: { axis: "reasons", covers: "the benefits of showing text" },
            children: [
              {
                claim: "People can recognise each document",
                evidence: [{ ref: "plan.md", source: "Proposal" }],
              },
              {
                claim: "People can open the right document",
                evidence: [{ ref: "plan.md", source: "Proposal" }],
              },
            ],
          },
        ],
      },
    },
    { resolves: () => true }
  )
  const md = toMarkdown(tree)
  assert.match(md, /^- \*\*B\.\*\* Show the text of the document \(chosen\)$/m)
  assert.match(md, /^  - \*\*B1\.\*\* People can recognise each document$/m)
  assert.match(md, /^    - Proposal: `plan.md`$/m)
  assert.doesNotMatch(md, /Verdict:/)
})

test("shortens an evidence reference to a recognizable name", () => {
  assert.equal(
    shortRef("https://github.com/Rickvu309/opencv/pull/2133"),
    "PR 2133"
  )
  assert.equal(shortRef("https://example.test/proof/a%20b.txt"), "a b.txt")
  assert.equal(shortRef("https://example.test/proof/a%zz.txt"), "a%zz.txt")
  assert.equal(shortRef("https://example.test"), "example.test")
  assert.equal(
    shortRef("scripts/a-very-long-file-name-for-a-test.mjs:180"),
    "…me-for-a-test.mjs:180"
  )
})
