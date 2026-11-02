import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { focusLosses } from "./lib/pen-focus.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const penFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.pen.css"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)

const MISTAKE = `[data-pen-surface="app-shell"] button[aria-label="New chat"] {
  background: #ffffff;
  border-color: #e2e2e2;
  box-shadow: 0 1px 2px #0000000a;
}`

test("a pen.css rule that sets the box-shadow of a button without a focus rule is a focus loss", () => {
  const found = focusLosses(MISTAKE)
  assert.equal(found.length, 1)
  assert.equal(found[0].property, "box-shadow")
})

test("a pen.css rule fenced with :not(:focus-visible) is not a focus loss", () => {
  const fixed = MISTAKE.replace(
    'button[aria-label="New chat"]',
    'button[aria-label="New chat"]:not(:focus-visible)'
  )
  assert.deepEqual(focusLosses(fixed), [])
})

test("a pen.css reset is not a focus loss when the same element has its own :focus-visible rule", () => {
  const css = `${MISTAKE}
[data-pen-surface="app-shell"] button[aria-label="New chat"]:focus-visible {
  box-shadow: 0 0 0 3px var(--ring);
}`
  assert.deepEqual(focusLosses(css), [])
})

test("a pen.css outline reset on a link is a focus loss", () => {
  assert.equal(
    focusLosses('[data-pen-surface="x"] a { outline: none; }').length,
    1
  )
})

test("no pen.css rule removes the focus ring of a button, link or field", () => {
  const problems = penFiles().flatMap((file) =>
    focusLosses(readFileSync(path.join(root, file), "utf8")).map(
      (loss) =>
        `${file}:${loss.line} sets ${loss.property} on \`${loss.selector}\` and wins over the kit focus-visible ring. Fence it with :not(:focus-visible) or add a :focus-visible rule for the same element.`
    )
  )
  assert.deepEqual(problems, [])
})
