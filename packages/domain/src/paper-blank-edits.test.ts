import assert from "node:assert/strict"
import test from "node:test"
import {
  applyPaperEdits,
  blankCv,
  paperEditSchema,
  undoCoachEdit,
} from "./paper-doc/index.ts"

const headerEdit = paperEditSchema.parse({
  op: "setHeader",
  fields: { name: "Ada" },
})

test("an explicit header edit adds contact fields to a blank CV without changing the blank factory", () => {
  const blank = blankCv()
  const applied = applyPaperEdits(blank, blank, [headerEdit], () => "new1")
  assert.equal(applied.applied, 1)
  assert.equal(applied.target.kind, "cv")
  if (applied.target.kind !== "cv") throw new Error("Expected a CV")
  assert.equal(applied.target.header?.name, "Ada")
  assert.deepEqual(applied.target.blocks, blank.blocks)
  assert.equal(blank.header, undefined)
})

test("a header added after the basis was read is preserved and the stale edit refuses", () => {
  const blank = blankCv()
  const person = applyPaperEdits(
    blank,
    blank,
    [headerEdit],
    () => "new1"
  ).target
  const stale = applyPaperEdits(blank, person, [headerEdit], () => "new2")
  assert.equal(stale.applied, 0)
  assert.equal(stale.outcomes[0]?.status, "stale")
  assert.equal(person.kind === "cv" ? person.header?.name : undefined, "Ada")
})

test("an empty header edit does not seed a header", () => {
  const blank = blankCv()
  const empty = paperEditSchema.parse({ op: "setHeader", fields: {} })
  const applied = applyPaperEdits(blank, blank, [empty], () => "new1")
  assert.equal(applied.applied, 0)
  assert.deepEqual(applied.target, blank)
})

test("Undo removes an explicitly added header and keeps later paragraph typing", () => {
  const blank = blankCv()
  const post = applyPaperEdits(blank, blank, [headerEdit], () => "new1").target
  const typed = paperEditSchema.parse({
    op: "setText",
    blockId: "paragraph-1",
    text: "My later words",
  })
  const live = applyPaperEdits(post, post, [typed], () => "new2").target
  const undone = undoCoachEdit(blank, post, live, {
    reverted: blank,
    stripped: blank,
    broken: new Set(),
  })
  assert.equal(undone.ok, true)
  if (!undone.ok) throw new Error(undone.reason)
  assert.deepEqual(undone.target, { ...blank, blocks: live.blocks })
})

test("Undo refuses without damage when the person changed the added header", () => {
  const blank = blankCv()
  const post = applyPaperEdits(blank, blank, [headerEdit], () => "new1").target
  const changed = paperEditSchema.parse({
    op: "setHeader",
    fields: { name: "My later name" },
  })
  const live = applyPaperEdits(post, post, [changed], () => "new2").target
  const before = structuredClone(live)
  const undone = undoCoachEdit(blank, post, live, {
    reverted: blank,
    stripped: blank,
    broken: new Set(),
  })
  assert.equal(undone.ok, false)
  assert.deepEqual(live, before)
})
