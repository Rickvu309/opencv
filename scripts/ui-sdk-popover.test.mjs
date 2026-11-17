import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import {
  partialFonts,
  selectPortalLeavesParent,
} from "./lib/ui-sdk-popover.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("rich Paper tests keep the shared FontFaceSet event API", () => {
  assert.equal(
    partialFonts(
      'Object.defineProperty(document, "fonts", {value: {ready: Promise.resolve()}})'
    ),
    true
  )
  assert.equal(partialFonts("installTestFonts(Promise.resolve())"), false)
  const dir = new URL("../apps/web/src/features/paper/", import.meta.url)
  for (const file of readdirSync(dir).filter((name) =>
    /^rich-.*\.test\.tsx$/.test(name)
  ))
    assert.equal(
      partialFonts(readFileSync(new URL(file, dir), "utf8")),
      false,
      file
    )
})

test("a Select portal stays in its parent popup container", () => {
  assert.equal(selectPortalLeavesParent("<SelectPrimitive.Portal>"), true)
  assert.equal(
    selectPortalLeavesParent(
      "<SelectPrimitive.Portal container={container ?? undefined}>"
    ),
    false
  )
  assert.equal(
    selectPortalLeavesParent(read("packages/ui/src/components/select.tsx")),
    false
  )
  assert.match(
    read("packages/ui/src/components/popover.tsx"),
    /<PopupContainerContext value=\{container\}>/
  )
})
