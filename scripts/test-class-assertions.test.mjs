import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  SCANNED_ROOTS,
  countsByFile,
  scannedFile,
  testClassAssertions,
} from "./lib/test-class-assertions.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const KNOWN_FILE = "scripts/test-class-assertions.ratchet.json"
const FILE = "apps/web/src/features/settings/settings.test.tsx"

const fires = (source) => testClassAssertions(source, FILE).length

const MISTAKES = [
  'expect(back).toHaveClass("h-11", "shrink-0", "touch-manipulation")',
  'expect(field).not.toHaveClass("text-[13px]")',
  'expect(button.className).toContain("bg-primary")',
  'expect(content?.className).not.toContain("sm:max-w-sm")',
  "expect(button.className).toMatch(/(^|\\s)hover:bg-/)",
  'expect(control.className, control.textContent ?? "").toMatch(/\\bh-11\\b/)',
  'expect(el.getAttribute("class")).toContain("rounded-lg")',
  'expect(el.classList.contains("invisible")).toBe(true)',
  'expect(el).toHaveAttribute("class", "flex gap-2")',
  'expect(classes).toContain("@max-[479px]/settings:flex-col")',
  "expect(chip).toMatch(/bg-muted\\/70/)",
  'expect(cls.split(" ")).toEqual(["flex", "h-[52px]", "shrink-0"])',
]

const CLEAN = [
  'expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()',
  'expect(field).toHaveAttribute("aria-invalid", "true")',
  'expect(screen.getByRole("alert")).toHaveTextContent("Too many codes")',
  "expect(panelFit(content.className, window).problems).toEqual([])",
  'expect(style.display).toBe("block")',
  "expect(css).not.toMatch(/border-bottom/)",
  "expect(answer).toMatch(/hidden/i)",
  'expect(css).toContain("transition-duration: var(--duration-panel)")',
  'expect(file).toBe("text-reveal.tsx")',
  'expect(node.dataset.variant).toBe("primary")',
  'expect(summary).toHaveTextContent("Use flex hours")',
]

test("each class-string assertion in a test fires once", () => {
  for (const source of MISTAKES) assert.equal(fires(source), 1, source)
  assert.match(
    testClassAssertions(MISTAKES[0], FILE)[0],
    /^apps\/web\/src\/features\/settings\/settings\.test\.tsx:1: asserts toHaveClass; assert the role, name, value or what a click does instead$/
  )
})

test("role, name, value, text, style and fit assertions stay quiet", () => {
  for (const source of CLEAN)
    assert.deepEqual(testClassAssertions(source, FILE), [], source)
})

test("only app test files are scanned", () => {
  assert.equal(scannedFile(FILE), true)
  assert.equal(
    scannedFile("apps/web/src/features/settings/settings.tsx"),
    false
  )
  assert.equal(scannedFile("packages/ui/src/components/button.test.tsx"), false)
})

const scannedFiles = () =>
  execFileSync("git", ["ls-files", "--", ...SCANNED_ROOTS], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(scannedFile)
    .filter((file) => existsSync(path.join(root, file)))

test("app tests hold exactly the known class-string assertions, and the ratchet only shrinks", () => {
  const known = JSON.parse(readFileSync(path.join(root, KNOWN_FILE), "utf8"))
  const counts = countsByFile(
    scannedFiles().flatMap((file) =>
      testClassAssertions(readFileSync(path.join(root, file), "utf8"), file)
    )
  )
  const grew = Object.entries(counts)
    .filter(([file, count]) => count > (known[file] ?? 0))
    .map(
      ([file, count]) => `${file}: ${count} found, ${known[file] ?? 0} known`
    )
  assert.deepEqual(
    grew,
    [],
    "new class-string assertion: assert the role, name, value or what a click does instead"
  )
  const shrank = Object.entries(known)
    .filter(([file, count]) => (counts[file] ?? 0) < count)
    .map(
      ([file, count]) => `${file}: ${counts[file] ?? 0} found, ${count} known`
    )
  assert.deepEqual(
    shrank,
    [],
    `fixed class-string assertions: lower or remove the entry in ${KNOWN_FILE}`
  )
  assert.deepEqual(
    Object.keys(known),
    Object.keys(known).sort(),
    `${KNOWN_FILE} stays sorted`
  )
})
