import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import {
  shippedPlatformOverride,
  paperPickerActionTitle,
} from "./lib/ui-sdk-boundaries.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("browser platform overrides stay outside shipped kit modules", () => {
  for (const source of [
    "document.elementFromPoint = () => null",
    'const owner = document; const key = "elementFromPoint"; owner[key] = () => null',
    'const owner = globalThis.document; const install = Object.defineProperty; install(owner, "elementsFromPoint", { value: () => [] })',
    "const target = HTMLElement.prototype; Object.assign(target, { showPopover() {} })",
    "Object.defineProperties(Element.prototype, { checkVisibility: { value: () => true } })",
  ])
    assert.equal(shippedPlatformOverride(source), true, source)
  for (const source of [
    "const element = document.elementFromPoint(1, 2)",
    "const fake = {}; fake.elementFromPoint = () => null",
    'Object.defineProperty(document, "title", { value: "Paper" })',
  ])
    assert.equal(shippedPlatformOverride(source), false, source)
  assert.equal(
    shippedPlatformOverride(
      "document.elementFromPoint = () => null",
      "packages/ui/test/ui-sdk-platform.ts"
    ),
    false
  )
  for (const folder of ["components", "hooks", "lib"]) {
    const path = `packages/ui/src/${folder}`
    for (const file of readdirSync(
      new URL(`../${path}/`, import.meta.url)
    ).filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file)))
      assert.equal(
        shippedPlatformOverride(read(`${path}/${file}`), `${path}/${file}`),
        false,
        file
      )
  }
})

test("Paper picker dialog names describe the document kind after linking", () => {
  const header =
    'import { PopoverTitle as Heading } from "@workspace/ui/components/popover";'
  for (const source of [
    `${header}<Heading>Add CV</Heading>`,
    `${header}const action = kind === "cv" ? "Add CV" : "Add cover letter"; const caption = action; <Heading>{caption}</Heading>`,
    `${header}const caption = "Add " + "CV"; <Heading>{caption}</Heading>`,
  ])
    assert.equal(paperPickerActionTitle(source), true, source)
  for (const source of [
    `${header}<Heading>{kind === "cv" ? "CV" : "Cover letter"}</Heading>`,
    `${header}const action = "Add CV"; <button>{action}</button>`,
  ])
    assert.equal(paperPickerActionTitle(source), false, source)
  assert.equal(
    paperPickerActionTitle(
      read("apps/web/src/features/apply/apply-job-rail.tsx")
    ),
    false
  )
})
