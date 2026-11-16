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
  assert.ok(detect(mistake, page).length > 0)
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

test("toolbar, menu and shortcut callbacks cannot receive a raw editor", () => {
  const clean = read(lifecycle)
  const mistake = clean.replace(
    "options.mounted(liveHandle(editor))",
    "options.mounted(editor)"
  )
  assert.notEqual(mistake, clean)
  assert.ok(
    detect(mistake, lifecycle).includes(
      "Toolbar, menu and shortcut handlers need a live handle"
    )
  )
  assert.deepEqual(detect(clean, lifecycle), [])
  for (const handler of ["onClick", "onKeyDown", "onValueChange"]) {
    const raw = `const editor = mountRichPaperEditor(client, host); const control = <Button ${handler}={() => editor.toggleMark("bold")} />`
    assert.ok(
      detect(raw, page).includes(
        "Toolbar, menu and shortcut handlers need a live handle"
      )
    )
  }
})

test("in-flight editor calls check the live identity immediately before invoking", () => {
  const clean = read(lifecycle)
  const mistake = clean.replace("editor === target", "true")
  assert.notEqual(mistake, clean)
  assert.ok(
    detect(mistake, lifecycle).includes(
      "Editor calls must check the live handle at invocation"
    )
  )
  assert.deepEqual(detect(clean, lifecycle), [])
})
