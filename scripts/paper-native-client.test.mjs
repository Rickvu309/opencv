import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectNativeClientBasis } from "./lib/paper-native-client.mjs"

test("omitted and dropped native authority fires", () => {
  assert.deepEqual(
    detectNativeClientBasis(
      'if (name === "paper.shared") { validateBasis(shared, writer) }'
    ),
    ["public share requires owner edit authority"]
  )
  assert.deepEqual(
    detectNativeClientBasis(
      "function coachPaperOptions(options?: PaperQualification) {}"
    ),
    ["default Coach query accepts qualification as its query context"]
  )
  assert.deepEqual(
    detectNativeClientBasis("paperContract[name].output.parse(payload)"),
    ["qualified read uses the command contract instead of query schemas"]
  )
  assert.deepEqual(
    detectNativeClientBasis(
      "function fakePaperEdit(focus) { return paperContract.edit.input.parse({docId: focus.id, basedOn: focus.revision}) }"
    ),
    ["native proposal drops writer or nativeBasis"]
  )
  assert.deepEqual(
    detectNativeClientBasis(
      "const contextSchema = z.object({focusDoc: z.object({revision: z.number()})})"
    ),
    ["saved fake focus drops nativeBasis"]
  )
  assert.ok(
    detectNativeClientBasis(
      "function paperFocus() { return {revision: outline.revision, outline: outline.outline} }"
    ).includes("native focus drops its outline basis")
  )
})

test("native carry and separate legacy and Word helpers stay quiet", () => {
  for (const source of [
    'if (name === "paper.shared") { admitPaper(shared.paper, writer) }',
    "function fakePaperEdit(focus) { return paperContract.edit.input.parse({basedOn: focus.revision, writer: NATIVE_WRITER, nativeBasis: focus.nativeBasis}) }",
    "function coachPaperOptions() { return apiFetch(path) }",
    "function legacyEdit(focus) { return {basedOn: focus.revision} }",
    "function wordEdit(focus) { return {basedOn: focus.revision, edits: wordOps} }",
    "const contextSchema = z.object({focusDoc: z.object({nativeBasis: nativeBasisSchema.optional()})})",
  ])
    assert.deepEqual(detectNativeClientBasis(source), [])
})

test("actual Coach sources preserve the native integration invariant", () => {
  for (const file of [
    "apps/api/src/coach/context.ts",
    "apps/api/src/coach/task-runtime.ts",
    "apps/api/src/coach/fake.ts",
    "apps/web/src/lib/paper-qualification.ts",
    "apps/web/src/lib/coach-context.ts",
  ]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    assert.deepEqual(detectNativeClientBasis(text, file), [], file)
  }
})
