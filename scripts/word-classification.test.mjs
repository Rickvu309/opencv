import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/word-classification.mjs"

const mistakeAt29c4ce33 = `function isWordEdit(
  edit: unknown
): edit is { op: "setText" | "insert" | "delete"; text?: string } {
  if (!edit || typeof edit !== "object" || !("op" in edit)) return false
  return edit.op === "setText" || edit.op === "insert" || edit.op === "delete"
}
`

const cleanHelper = `const wordEditSchema = wordConfirmedOpsSchema.element

function isWordEdit(
  edit: unknown
): edit is { op: "setText" | "insert" | "delete"; text?: string } {
  return wordEditSchema.safeParse(edit).success
}

function wordEdits(input: unknown) {
  if (!input || typeof input !== "object") return null
  if (!("edits" in input) || !Array.isArray(input.edits)) return null
  if (input.edits.length === 0 || !input.edits.every(isWordEdit)) return null
  return input.edits
}
`

test("fires on the op-name predicate that hid Approve at 29c4ce33", () => {
  assert.deepEqual(
    detect(mistakeAt29c4ce33).map(({ kind, line }) => ({ kind, line })),
    [{ kind: "word-classification-without-schema", line: 1 }]
  )
})

test("fires on other ways of guessing a Word batch from raw input", () => {
  assert.equal(
    detect(
      'function isWordBatch(edit: unknown) { return !!edit && typeof edit === "object" && "handle" in edit }'
    ).length,
    1
  )
  assert.equal(
    detect(
      'const wordOnly = (edits: unknown[]) => edits.every((edit) => edit.op === "insert" || edit.op === "setText")'
    ).length,
    1
  )
  assert.equal(
    detect(
      'function looksLikeWord(value: unknown): boolean { return (value as { op: string }).op === "delete" || value.op === "delete" }'
    ).length,
    1
  )
})

test("stays quiet on the schema helper and on already-parsed values", () => {
  assert.deepEqual(detect(cleanHelper), [])
  assert.deepEqual(
    detect(
      "function isWordEdit(edit: unknown) { return wordConfirmedOpsSchema.element.safeParse(edit).success }"
    ),
    []
  )
  assert.deepEqual(
    detect(
      'function isWordProposal(proposal: WritingProposal) { return proposal.changes.some((change: WritingChange) => change.op !== "replace") }'
    ),
    []
  )
  assert.deepEqual(
    detect(
      'function view(review: unknown) { const parsed = wordReviewSchema.parse(review); for (const operation of parsed.operations) { if (operation.op !== "insert") continue } }'
    ),
    []
  )
})

test("web code decides Word edits only through the domain schema", () => {
  const files = execFileSync("git", ["ls-files", "apps/web/src"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))
  assert.deepEqual(
    files.flatMap((file) => detect(readFileSync(file, "utf8"), file)),
    []
  )
})
