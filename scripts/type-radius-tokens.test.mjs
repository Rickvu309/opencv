import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import {
  RATCHET_FILE,
  detect,
  dropsKitTypeToken,
  migrate,
  offScaleCounts,
  repoRoot,
  trackedSources,
} from "./type-radius-tokens.mjs"

const MISTAKE = `export const Row = () => (
  <label className="text-[13px] rounded-[7px]">
    <span className="text-[12.5px] leading-4">Shown on every Chat</span>
    <div className="rounded-b-[12px] text-[15px] rounded-[4px] text-[0.8rem]" />
  </label>
)`

const CLEAN = `export const Row = () => (
  <label className="text-ui rounded-md md:text-ui">
    <span className="text-xs leading-[15px] [&_svg]:size-[15px]">Shown on every Chat</span>
    <div className="rounded-b-lg max-w-[680px] text-[var(--x)] rounded-[inherit]" />
  </label>
)`

test("an arbitrary pixel or rem type size or pixel radius fires and names the token to use", () => {
  assert.deepEqual(
    detect(MISTAKE).map(({ line, literal, hint }) => [line, literal, hint]),
    [
      [2, "text-[13px]", "use text-ui"],
      [2, "rounded-[7px]", "use rounded-md"],
      [3, "text-[12.5px]", "use text-xs"],
      [
        4,
        "text-[15px]",
        "use a type size from the scale (text-xs 12px, text-ui 13px, text-sm 14px, text-base 16px, text-lg 18px, text-xl 20px)",
      ],
      [
        4,
        "text-[0.8rem]",
        "use a type size from the scale (text-xs 12px, text-ui 13px, text-sm 14px, text-base 16px, text-lg 18px, text-xl 20px)",
      ],
      [4, "rounded-b-[12px]", "use rounded-b-lg"],
      [
        4,
        "rounded-[4px]",
        "use a radius token (rounded-xs 2px, rounded-sm 6px, rounded-md 8px, rounded-lg 10px, rounded-xl 14px, rounded-2xl 18px)",
      ],
    ]
  )
})

test("type and radius tokens, arbitrary sizes of other things and variable sizes stay quiet", () => {
  assert.deepEqual(detect(CLEAN), [])
})

test("the codemod moves each literal with a token, keeps variants and leaves the rest for a person", () => {
  const before = `const a = "md:text-[13px] text-base rounded-[10px]"
const b = cn("text-[12.5px] max-md:rounded-tl-[6px]", "text-[15px] rounded-[3.5px]")`
  assert.equal(
    migrate(before),
    `const a = "md:text-ui text-base rounded-lg"
const b = cn("text-xs max-md:rounded-tl-sm", "text-[15px] rounded-[3.5px]")`
  )
  assert.equal(migrate(migrate(before)), migrate(before))
})

test("a file that uses text-ui must merge classes with the kit cn, which knows text-ui is a type size", () => {
  const bare = `import { cn } from "cn"
export const label = cn("text-ui text-muted-foreground")`
  const kit = `import { cn } from "@workspace/ui/lib/utils"
export const label = cn("text-ui text-muted-foreground")`
  assert.equal(dropsKitTypeToken(bare), true)
  assert.equal(
    migrate(
      `import { cn } from "cn"\nconst a = cn("text-[13px] text-muted-foreground")`
    ),
    `import { cn } from "@workspace/ui/lib/utils"\nconst a = cn("text-ui text-muted-foreground")`
  )
  assert.equal(dropsKitTypeToken(kit), false)
  assert.equal(
    dropsKitTypeToken(`import { cn } from "cn"\nconst a = "text-xs"`),
    false
  )
  const dropping = trackedSources().filter((file) =>
    dropsKitTypeToken(readFileSync(path.join(repoRoot, file), "utf8"))
  )
  assert.deepEqual(
    dropping,
    [],
    'the stock cn reads text-ui as a colour and drops it next to text-muted-foreground: import cn from "@workspace/ui/lib/utils"'
  )
})

test("the app and the kit hold only the known off-scale type sizes and radii, and the ratchet only shrinks", () => {
  const known = JSON.parse(
    readFileSync(path.join(repoRoot, RATCHET_FILE), "utf8")
  )
  const counts = offScaleCounts()
  const grew = Object.entries(counts)
    .filter(([file, count]) => count > (known[file] ?? 0))
    .flatMap(([file]) =>
      detect(readFileSync(path.join(repoRoot, file), "utf8")).map(
        ({ line, literal, hint }) => `${file}:${line} ${literal}: ${hint}`
      )
    )
  assert.deepEqual(grew, [], "new off-scale type size or radius")
  const shrank = Object.entries(known)
    .filter(([file, count]) => (counts[file] ?? 0) < count)
    .map(
      ([file, count]) => `${file}: ${counts[file] ?? 0} found, ${count} known`
    )
  assert.deepEqual(
    shrank,
    [],
    `fewer off-scale literals than ${RATCHET_FILE} records. Run: node scripts/type-radius-tokens.mjs --ratchet`
  )
})
