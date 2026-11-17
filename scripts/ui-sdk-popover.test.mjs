import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import {
  partialFonts,
  fontsWithoutDocument,
  selectPortalLeavesParent,
  popoverOnlyShifts,
  popoverInheritsCallerStyles,
  sdkLayerOverridesKit,
  fractionalPopoverPosition,
  popoverEscapeBubbles,
  popoverRestoresPriorField,
} from "./lib/ui-sdk-popover.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("shared FontFaceSet setup leaves Node test environments alone", () => {
  assert.equal(
    fontsWithoutDocument("beforeEach(() => { installTestFonts() })"),
    true
  )
  assert.equal(
    fontsWithoutDocument(
      'beforeEach(() => { if (typeof document !== "undefined") installTestFonts() })'
    ),
    false
  )
  assert.equal(fontsWithoutDocument(read("apps/web/src/test/setup.ts")), false)
})

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

test("SDK popovers flip alignment before shifting at viewport edges", () => {
  const sdk =
    'import { PopoverContent as PopoverPopup } from "@ui-sdk/react/popover"'
  assert.equal(popoverOnlyShifts(`${sdk}<PopoverPopup align={align} />`), true)
  assert.equal(
    popoverOnlyShifts(`${sdk}<PopoverPopup align={collisionAlign} />`),
    false
  )
  assert.equal(
    popoverOnlyShifts(read("packages/ui/src/components/popover.tsx")),
    false
  )
})

test("SDK popovers escape caller descendant button colors", () => {
  const sdk =
    'import { PopoverContent as PopoverPopup } from "@ui-sdk/react/popover"'
  assert.equal(popoverInheritsCallerStyles(`${sdk}<PopoverPopup />`), true)
  assert.equal(
    popoverInheritsCallerStyles(
      `${sdk}<PopoverPopup container={trigger.ownerDocument.body} />`
    ),
    false
  )
  assert.equal(
    popoverInheritsCallerStyles(read("packages/ui/src/components/popover.tsx")),
    false
  )
})

test("SDK reset colors stay below kit component utility colors", () => {
  assert.equal(
    sdkLayerOverridesKit('@import "tailwindcss";\n@layer ui-sdk;'),
    true
  )
  assert.equal(sdkLayerOverridesKit('@import "tailwindcss";'), true)
  assert.equal(
    sdkLayerOverridesKit('@layer ui-sdk;\n@import "tailwindcss";'),
    false
  )
  assert.equal(
    sdkLayerOverridesKit(read("packages/ui/src/styles/globals.css")),
    false
  )
})

test("SDK popup coordinates use the same device pixel grid as Base UI", () => {
  const sdk = 'import { PopoverContent } from "@ui-sdk/react/popover"'
  assert.equal(fractionalPopoverPosition(sdk), true)
  assert.equal(
    fractionalPopoverPosition(
      `${sdk}popoverCoordinate(coordinate, view.devicePixelRatio || 1)`
    ),
    false
  )
  assert.equal(
    fractionalPopoverPosition(read("packages/ui/src/components/popover.tsx")),
    false
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

test("SDK popover Escape dismissal does not reach the parent dialog", () => {
  const sdk = 'import { Popover } from "@ui-sdk/react/popover"'
  assert.equal(
    popoverEscapeBubbles(`${sdk}onOpenChange?.(open, details)`),
    true
  )
  assert.equal(
    popoverEscapeBubbles(
      `${sdk}event.stopPropagation(); controller.close({ reason: "escape-key", event })`
    ),
    false
  )
  assert.equal(
    popoverEscapeBubbles(read("packages/ui/src/components/popover.tsx")),
    false
  )
})

test("SDK popovers return default focus to their own trigger", () => {
  const sdk = 'import { Popover } from "@ui-sdk/react/popover"'
  assert.equal(
    popoverRestoresPriorField(`${sdk}return closing ? "trigger" : "auto"`),
    true
  )
  assert.equal(
    popoverRestoresPriorField(
      `${sdk}return closing ? () => focus?.trigger.current : "auto"`
    ),
    false
  )
  assert.equal(
    popoverRestoresPriorField(read("packages/ui/src/components/popover.tsx")),
    false
  )
})
