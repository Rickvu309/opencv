import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { handTouchPairs, smallTargets } from "./lib/touch-targets.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const PAIRS_KNOWN_FILE = "scripts/touch-pairs.ratchet.json"

const trackedTsx = (...roots) =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...roots],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .filter((file) => existsSync(path.join(root, file)))

const featureFiles = () => trackedTsx("apps/web/src/features")

const MISTAKE = `const row = "flex h-7 items-center rounded-md px-2 hover:bg-sidebar-accent"
export const menu = <Button size="icon-sm" aria-label="Menu" />`

test("a nav row or icon button that is 28px tall on a phone is a small target", () => {
  assert.equal(smallTargets(MISTAKE).length, 2)
})

test("a nav row or icon button that is 44px on a phone and 28px on desktop passes", () => {
  const fixed = `const row = "flex h-11 items-center rounded-md px-2 hover:bg-sidebar-accent md:h-7"
export const menu = <Button size="icon-sm" className="size-11 md:size-7" aria-label="Menu" />`
  assert.deepEqual(smallTargets(fixed), [])
})

test("a button that is 44px tall and 28px wide on a phone is a small target", () => {
  const narrow = `export const filter = <Button className="h-11 w-7 md:h-7" aria-label="Filter" />`
  const found = smallTargets(narrow)
  assert.equal(found.length, 1)
  assert.match(found[0].why, /w-7/)
})

test("a button that is 44px square on a phone and 28px on desktop passes", () => {
  const wide = `export const filter = <Button className="h-11 w-11 md:h-7 md:w-7" aria-label="Filter" />`
  assert.deepEqual(smallTargets(wide), [])
})

test("a button that may shrink, and is 44px tall on a phone, is not a narrow target", () => {
  const row = `export const row = <Button className="h-11 min-w-0 md:h-7" aria-label="Row" />`
  assert.deepEqual(smallTargets(row), [])
})

test("a non-interactive 28px block is not a target", () => {
  assert.deepEqual(smallTargets('const a = "mx-2 mt-3 h-7"'), [])
})

test("every interactive control in features is 44px on a phone", () => {
  const problems = featureFiles().flatMap((file) => {
    const found = smallTargets(
      readFileSync(path.join(root, file), "utf8"),
      file
    )
    return found.map(
      (item) =>
        `${file}:${item.line} ${item.why}. A phone target is at least 44px; keep the desktop size behind md:.`
    )
  })
  assert.deepEqual(problems, [])
})

const HAND_PAIR = `export const save = <Button className="h-11 md:h-8">Save</Button>
export const open = <Button variant="ghost" className={cn("h-11 md:h-9", ROW)}>Open</Button>`

test("a Button that hand-writes the phone height pair is told to use the kit touch size", () => {
  const found = handTouchPairs(HAND_PAIR)
  assert.deepEqual(
    found.map(({ line, kitSize }) => ({ line, kitSize })),
    [
      { line: 1, kitSize: "touch" },
      { line: 2, kitSize: "touch-lg" },
    ]
  )
  assert.match(found[0].why, /size="touch"/)
})

test("a Button on the kit touch size passes both checks", () => {
  const kit = `export const save = <Button size="touch">Save</Button>
export const open = <Button size="touch-lg" variant="ghost" className={ROW}>Open</Button>`
  assert.deepEqual(handTouchPairs(kit), [])
  assert.deepEqual(smallTargets(kit), [])
})

test("an Input keeps its own phone height pair", () => {
  assert.deepEqual(
    handTouchPairs(`export const name = <Input className="h-11 md:h-8" />`),
    []
  )
})

test("the app and the kit hold only the known hand-written Button height pairs, and the ratchet only shrinks", () => {
  const known = JSON.parse(
    readFileSync(path.join(root, PAIRS_KNOWN_FILE), "utf8")
  )
  const counts = Object.fromEntries(
    trackedTsx("apps/web/src", "packages/ui/src")
      .map((file) => [
        file,
        handTouchPairs(readFileSync(path.join(root, file), "utf8"), file),
      ])
      .filter(([, found]) => found.length > 0)
  )
  const grew = Object.entries(counts)
    .filter(([file, found]) => found.length > (known[file] ?? 0))
    .flatMap(([file, found]) =>
      found.map((item) => `${file}:${item.line} ${item.why}`)
    )
  assert.deepEqual(
    grew,
    [],
    "new hand-written h-11 md:h-* pair on a Button: use the kit touch size"
  )
  const shrank = Object.entries(known)
    .filter(([file, count]) => (counts[file]?.length ?? 0) < count)
    .map(
      ([file, count]) =>
        `${file}: ${counts[file]?.length ?? 0} found, ${count} known`
    )
  assert.deepEqual(
    shrank,
    [],
    `moved a pair to the kit size: lower or remove its entry in ${PAIRS_KNOWN_FILE}`
  )
  assert.deepEqual(
    Object.keys(known),
    Object.keys(known).sort(),
    `${PAIRS_KNOWN_FILE} stays sorted`
  )
})
