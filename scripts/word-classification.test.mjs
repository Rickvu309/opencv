import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/word-classification.mjs"

const mistake =
  'function isWordEdit(\n  edit: unknown\n): edit is { op: "setText" | "insert" | "delete"; text?: string } {\n  if (!edit || typeof edit !== "object" || !("op" in edit)) return false\n  return edit.op === "setText" || edit.op === "insert" || edit.op === "delete"\n}\n'
const clean =
  "const wordEditSchema = wordConfirmedOpsSchema.element; function isWordEdit(edit: unknown) { return wordEditSchema.safeParse(edit).success }"

test("web Word classification uses the domain operation schema", () => {
  assert.equal(detect(mistake).length, 1)
  assert.deepEqual(detect(clean), [])
  assert.equal(
    detect('function isWordBatch(edit: unknown) { return "handle" in edit }')
      .length,
    1
  )
  assert.deepEqual(
    detect(
      "function isWordEdit(edit: unknown) { return wordConfirmedOpsSchema.element.safeParse(edit).success }"
    ),
    []
  )
  assert.equal(
    detect(
      'const isWordBatch = (edits: unknown[]): boolean => edits.every(edit => edit.op === "insert")'
    ).length > 0,
    true
  )
  const files = execFileSync("git", ["ls-files", "apps/web/src"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))
  assert.deepEqual(
    files.flatMap((file) =>
      detect(readFileSync(file, "utf8"), file).map((problem) => ({
        file,
        ...problem,
      }))
    ),
    []
  )
})
