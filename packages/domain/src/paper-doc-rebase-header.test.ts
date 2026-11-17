import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyPaperEdits,
  blankCv,
  paperDocumentSchema,
  paperEditSchema,
  paperPlainText,
  richTextSchema,
  type CvPaper,
} from "./paper-doc/index.ts"
import { rebasePending } from "./paper-doc/rebase.ts"

function contact(base: CvPaper, fields: { name?: string; email?: string }) {
  const result = applyPaperEdits(
    base,
    base,
    [paperEditSchema.parse({ op: "setHeader", fields })],
    () => "new1"
  ).target
  if (result.kind !== "cv") throw new Error("Expected a CV")
  return result
}

function withoutHeader(base: CvPaper): CvPaper {
  const copy = structuredClone(base)
  delete copy.header
  return copy
}

function rebase(base: CvPaper, ours: CvPaper, theirs: CvPaper) {
  const inputs = structuredClone({ base, ours, theirs })
  const result = rebasePending({ base, ours, theirs })
  assert.equal(result.failed, false)
  assert.equal(paperDocumentSchema.safeParse(result.document).success, true)
  assert.deepEqual({ base, ours, theirs }, inputs)
  if (result.document.kind !== "cv") throw new Error("Expected a CV")
  return result.document
}

describe("three-way CV contact presence", () => {
  it("merges independent first contact edits against empty defaults in either order", () => {
    const base = blankCv()
    const name = contact(base, { name: "Ada" })
    const email = contact(base, { email: "ada@example.com" })
    for (const [ours, theirs] of [
      [name, email],
      [email, name],
    ]) {
      const result = rebase(base, ours!, theirs!)
      assert.equal(result.header?.name, "Ada")
      assert.equal(result.header?.email, "ada@example.com")
      assert.deepEqual(result.blocks, base.blocks)
    }
  })

  it("keeps removal over an untouched header while retaining unrelated typing in either direction", () => {
    const base = contact(blankCv(), { name: "Ada" })
    const typed = structuredClone(base)
    typed.blocks[0] = {
      ...typed.blocks[0]!,
      type: "paragraph",
      content: richTextSchema.parse([{ text: "Later typing" }]),
    }
    const removed = withoutHeader(base)
    for (const [ours, theirs] of [
      [typed, removed],
      [removed, typed],
    ]) {
      const result = rebase(base, ours!, theirs!)
      assert.equal(result.header, undefined)
      assert.match(paperPlainText(result), /Later typing/)
    }
    assert.equal(rebase(base, removed, removed).header, undefined)
  })

  it("keeps a changed contact over a removal in either direction", () => {
    const base = contact(blankCv(), { name: "Ada" })
    const edited = contact(base, { email: "ada@example.com" })
    const removed = withoutHeader(base)
    for (const [ours, theirs] of [
      [edited, removed],
      [removed, edited],
    ]) {
      const result = rebase(base, ours!, theirs!)
      assert.deepEqual(result.header, edited.header)
    }
  })

  it("keeps unilateral additions and leaves a blank document blank", () => {
    const base = blankCv()
    const added = contact(base, { name: "Ada" })
    assert.deepEqual(rebase(base, base, added), added)
    assert.deepEqual(rebase(base, added, base), added)
    assert.deepEqual(rebase(base, base, base), base)
  })

  it("uses the existing local field winner without changing body content", () => {
    for (const base of [
      blankCv(),
      contact(blankCv(), { email: "before@example.com" }),
    ]) {
      const ours = contact(base, { email: "local@example.com" })
      const theirs = contact(base, { email: "remote@example.com" })
      const result = rebase(base, ours, theirs)
      assert.equal(result.header?.email, "local@example.com")
      assert.deepEqual(result.blocks, base.blocks)
    }
  })

  it("retains explicit field clears and does not duplicate identical edits", () => {
    const base = contact(blankCv(), {
      name: "Ada",
      email: "before@example.com",
    })
    const ours = contact(base, { email: "" })
    const theirs = contact(base, { name: "Ada Lovelace" })
    const result = rebase(base, ours, theirs)
    assert.equal(result.header?.name, "Ada Lovelace")
    assert.equal(result.header?.email, "")
    const same = rebase(base, theirs, theirs)
    assert.deepEqual(same, theirs)
  })
})
