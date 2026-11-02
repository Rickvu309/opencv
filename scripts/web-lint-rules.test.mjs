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
