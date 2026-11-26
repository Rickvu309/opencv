import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-editor-lifecycle.mjs"

const page = "apps/web/src/features/paper/rich-editor/rich-page.tsx"
const lifecycle =
  "apps/web/src/features/paper/rich-editor/rich-editor-lifecycle.ts"
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

test("the table menu releases with the editor and mounts again from the live handle", () => {
  const controls = "apps/web/src/features/paper/rich-table-controls.tsx"
  const menu = "apps/web/src/features/paper/rich-table-menu.tsx"
  assert.deepEqual(detect(read(controls), controls), [])
  assert.deepEqual(detect(read(menu), menu), [])
  assert.deepEqual(detect(read(page), page), [])
  const leaked = read(controls).replace(
    "anchor.remove()",
    "anchor.hidden = true"
  )
  assert.notEqual(leaked, read(controls))
  assert.ok(
    detect(leaked, controls).includes(
      "The table menu must release on editor teardown"
    )
  )
  const raw = `${read(menu)}\nmountRichPaperEditor(client, host)`
  assert.ok(
    detect(raw, menu).includes(
      "Toolbar, menu and shortcut handlers need a live handle"
    )
  )
  const detached = read(page).replace(
    "<RichTableControls editor={editor}",
    "<RichTableControls "
  )
  assert.notEqual(detached, read(page))
  assert.ok(
    detect(detached, page).includes(
      "The table menu must follow editor availability"
    )
  )
})

test("nested search controls use the same live handle", () => {
  const clean = read(lifecycle)
  assert.deepEqual(detect(clean, lifecycle), [])
  for (const mistake of [
    clean.replace("new Proxy(target.search,", "new Proxy(target,"),
    clean.replace('if (key === "search") return search', ""),
  ]) {
    assert.notEqual(mistake, clean)
    assert.ok(
      detect(mistake, lifecycle).includes(
        "Search controls must use the live editor handle"
      )
    )
  }
})

test("the document menu follows editor availability", () => {
  const clean = read(page)
  const mistake = clean.replace("editorAvailable={!!editor}", "")
  assert.notEqual(mistake, clean)
  assert.deepEqual(detect(clean, page), [])
  assert.ok(
    detect(mistake, page).includes(
      "Document menu must follow editor availability"
    )
  )
})
