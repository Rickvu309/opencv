import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const web = path.join(root, "apps/web")
const { ESLint } = createRequire(path.join(web, "package.json"))("eslint")
const eslint = new ESLint({ cwd: web })

async function messages(code, file) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(web, file),
  })
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => message.message)
}

const SHELL = "src/features/app-shell/sidebar-frame.tsx"

test("a zone that opens the peek straight from onPointerEnter has no hover intent", async () => {
  const found = await messages(
    `export const a = <div onPointerEnter={(event) => { if (event.pointerType === "mouse") layout.peekEnter() }} />`,
    SHELL
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /Popover or Tooltip.*useHoverIntent/)
})

test("onMouseEnter, onMouseOver and onPointerOver are refused outside the app shell too", async () => {
  for (const name of ["onMouseEnter", "onMouseOver", "onPointerOver"]) {
    const found = await messages(
      `export const a = <div ${name}={open} />`,
      "src/features/inbox/row.tsx"
    )
    assert.equal(found.length, 1, name)
  }
})

test("a hover prop is allowed in a test and in a listed list-highlight file", async () => {
  const code = `export const a = <div onMouseEnter={highlight} />`
  assert.deepEqual(await messages(code, "src/features/inbox/row.test.tsx"), [])
  assert.deepEqual(
    await messages(code, "src/features/command-palette/command-palette.tsx"),
    []
  )
})

test("useHoverIntent props spread onto an element are not refused", async () => {
  assert.deepEqual(
    await messages(
      `export const a = <div {...hover.triggerProps} />`,
      "src/features/inbox/row.tsx"
    ),
    []
  )
})

test("a region hidden with inert={hidden} can drop focus to the page body", async () => {
  const found = await messages(
    `export const a = <aside inert={hidden} />`,
    SHELL
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /FocusSafeRegion/)
})

test("a static inert attribute and FocusSafeRegion are allowed", async () => {
  assert.deepEqual(
    await messages(
      `export const a = <div inert />`,
      "src/features/paper/paper-print-sheet.tsx"
    ),
    []
  )
  assert.deepEqual(
    await messages(
      `export const a = <FocusSafeRegion concealed={hidden} focusFallback={f} />`,
      SHELL
    ),
    []
  )
})

test("writing a custom property from a drag handler restyles every inheriting element", async () => {
  const found = await messages(
    `function showWidth(drag, width) { drag.frame?.style.setProperty("--sidebar-width", width + "px") }`,
    "src/features/app-shell/sidebar-resize-handle.tsx"
  )
  assert.equal(found.length, 1)
  assert.match(found[0], /style\.width or style\.transform/)
})

test("writing a custom property on the root element is refused in any feature", async () => {
  const found = await messages(
    "document.documentElement.style.setProperty(`--x`, 1)",
    "src/features/paper/anything.ts"
  )
  assert.ok(found.length >= 1)
})

test("writing a plain style property is allowed", async () => {
  assert.deepEqual(
    await messages(
      `function f(el) { el.style.setProperty("user-select", "none"); el.style.width = "10px" }`,
      "src/features/app-shell/sidebar-resize-handle.tsx"
    ),
    []
  )
})
