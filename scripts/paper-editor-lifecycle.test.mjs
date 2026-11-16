import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-editor-lifecycle.mjs"

const page = "apps/web/src/features/paper/rich-page.tsx"
const lifecycle = "apps/web/src/features/paper/rich-editor-lifecycle.ts"
const editor = "packages/paper-crdt/src/editor.ts"
const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8")

test("a client-only mount is refused and a lifecycle mount stays quiet", () => {
  const mistake =
    "useEffect(() => mountRichPaperEditor(client, host), [client])"
  const clean = mistake.replace(
    "mountRichPaperEditor",
    "mountRichEditorLifecycle"
  )
  assert.equal(detect(mistake, page).length, 1)
  assert.deepEqual(detect(clean, page), [])
  assert.deepEqual(detect(read(page), page), [])
})

test("release, reset remount, selection and unavailable toolbar stay connected", () => {
  const clean = read(lifecycle)
  assert.deepEqual(detect(clean, lifecycle), [])
  for (const operation of [
    "onDocumentRelease",
    "subscribe",
    "captureSelection",
    "restoreSelection",
    "released",
  ]) {
    const mistake = clean.replace(`.${operation}`, ".missing")
    assert.notEqual(mistake, clean)
    assert.ok(detect(mistake, lifecycle).length > 0)
  }
  const noReset = clean.replace('change === "reset"', 'change === "local"')
  assert.notEqual(noReset, clean)
  assert.ok(detect(noReset, lifecycle).length > 0)
})

test("stale formatting handlers cannot throw the closed editor error", () => {
  const mistake =
    'function toggleMark() { throw new Error("Paper editor is closed") }'
  assert.equal(detect(mistake, editor).length, 1)
  assert.deepEqual(detect("function toggleMark() { return }", editor), [])
  assert.deepEqual(detect(read(editor), editor), [])
})
