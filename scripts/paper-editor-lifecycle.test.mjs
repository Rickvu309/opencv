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
  for (const operation of ["subscribe", "restoreSelection", "released"]) {
    const mistake = clean.replace(`.${operation}`, ".missing")
    assert.notEqual(mistake, clean)
    assert.ok(detect(mistake, lifecycle).length > 0)
  }
  const noReset = clean.replace('change === "reset"', 'change === "local"')
  assert.notEqual(noReset, clean)
  assert.ok(detect(noReset, lifecycle).length > 0)
})

test("closed editor throws are detected by public method and toolbar structure", () => {
  const method = (body) =>
    `function mount() {
      let alive = true
      const destroy = () => { alive = false }
      return { commands: { format() { ${body} } }, destroy }
    }`
  for (const condition of ["!alive", "alive === false", "(!alive)"])
    assert.ok(
      detect(
        method(`if (${condition}) throw new Error("Unavailable")`),
        editor
      ).includes("Released editor handlers must be harmless")
    )
  const toolbar = (body) =>
    `function Page() {
      mountRichEditorLifecycle(client, host)
      return <button onClick={() => { ${body} }} />
    }`
  assert.deepEqual(
    detect(
      toolbar('if (!editor) { throw new TypeError("Unavailable") }'),
      page
    ),
    ["Released editor handlers must be harmless"]
  )
  assert.deepEqual(detect(toolbar("if (!editor) return"), page), [])
  for (const clean of [
    method("if (!alive) return"),
    method('if (!alive) return; else throw new Error("Unrelated")'),
    method('const message = "Paper editor is closed"'),
    'function mount() { throw new Error("Document required") }',
  ])
    assert.ok(
      !detect(clean, editor).includes(
        "Released editor handlers must be harmless"
      )
    )
  assert.deepEqual(detect(read(editor), editor), [])
})

test("selection capture stays inside editor release before notification and unmount", () => {
  const clean = read(editor)
  for (const operation of [
    "captureEditorSelection(view)",
    "options.onRelease?.(selection)",
  ]) {
    const mistake = clean.replace(operation, "undefined")
    assert.notEqual(mistake, clean)
    assert.ok(
      detect(mistake, editor).includes(
        "Editor release must capture selection before unmount"
      )
    )
  }
  const mistake = clean.replace(
    "options.onRelease?.(selection)\n      mounted.unmount()",
    "mounted.unmount()\n      options.onRelease?.(selection)"
  )
  assert.notEqual(mistake, clean)
  assert.ok(
    detect(mistake, editor).includes(
      "Editor release must capture selection before unmount"
    )
  )
})
