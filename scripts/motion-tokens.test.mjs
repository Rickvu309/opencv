import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  SCANNED_ROOTS,
  countsByFile,
  motionTokenProblems,
  scannedFile,
} from "./lib/motion-tokens.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const KNOWN_FILE = "scripts/motion-tokens.ratchet.json"

const reasonsOf = (problems) =>
  problems.map((problem) => problem.replace(/^[^:]+:\d+: /, ""))

const fires = (source, file) => motionTokenProblems(source, file).length

const MISTAKES = [
  [
    ".x { transition-duration: 150ms; }",
    "apps/web/src/features/paper/cv-editor.css",
  ],
  [
    ".x { transition: box-shadow 0.2s ease, border-color 0.2s ease; }",
    "apps/web/src/styles/paper.css",
  ],
  [
    'export const a = "inline-flex transition-all"',
    "packages/ui/src/components/button.tsx",
  ],
  [
    'export const a = "data-open:animate-in data-open:fade-in-0"',
    "packages/ui/src/components/tooltip.tsx",
  ],
  [
    'export const a = "transition-[width] duration-(--duration-panel)"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "duration-300 ease-out"',
    "apps/web/src/features/inbox/inbox-page.tsx",
  ],
  [
    ".x { transition: color var(--duration-micro) ease; }",
    "packages/ui/src/styles/globals.css",
  ],
  [
    ".x { transition: opacity var(--duration-micro) linear; }",
    "apps/web/src/styles/coach.css",
  ],
  [
    ".x { --fade: 200ms; transition: opacity var(--fade) var(--ease-micro); }",
    "apps/web/src/styles/coach.css",
  ],
  [
    ".x { --swing: cubic-bezier(0.4, 0, 0.2, 1); }",
    "apps/web/src/styles/coach.css",
  ],
  [
    'export const S = () => <div style={{ transition: "opacity 200ms var(--ease-micro)" }} />',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const S = () => <div style={{ transitionTimingFunction: "ease-in-out" }} />',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    "export const S = (ms: number) => <div style={{ transitionDuration: `${ms}ms` }} />",
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const S = () => <div style={{ "--lift": "120ms" }} />',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "[transition:opacity_200ms_ease]"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "ease-[cubic-bezier(0.4,0,0.2,1)]"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "delay-75 transition-opacity"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "duration-[250ms]"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    ".x { transition: margin-left var(--duration-panel) var(--ease-panel); }",
    "apps/web/src/styles/paper.css",
  ],
  [
    ".x { transition-property: font-size; }",
    "apps/web/src/features/paper/cv-editor.css",
  ],
  [
    ".x { transition: all var(--duration-micro) var(--ease-micro); }",
    "apps/web/src/styles/paper.css",
  ],
  [
    ".x { transition: top var(--duration-micro) var(--ease-micro); }",
    "packages/ui/src/components/sonner.css",
  ],
  [
    'export const a = "transition-[padding-left]"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    'export const a = "[transition:height_var(--duration-panel)_var(--ease-panel)]"',
    "apps/web/src/features/apply/apply-board.tsx",
  ],
  [
    "export const css = `.x { transition: opacity 0.3s ease; }`",
    "packages/ui/src/components/thinking-loader-styles.ts",
  ],
  [
    'export const go = (el: Element) => el.animate([{ opacity: 0 }], { duration: 200, easing: "ease-out" })',
    "packages/ui/src/lib/motion.ts",
  ],
]

test("each hand-written timing, curve, transition-all, library keyframe and layout transition fires once", () => {
  for (const [source, file] of MISTAKES)
    assert.equal(fires(source, file), 1, `${file}: ${source}`)
  assert.deepEqual(
    reasonsOf(
      motionTokenProblems(
        ".x { transition: box-shadow 0.2s ease, border-color 0.2s ease; }",
        "apps/web/src/styles/paper.css"
      )
    ),
    [
      "uses a literal duration or delay; use var(--duration-micro) or var(--duration-panel); uses a plain curve keyword or a hand-written curve; use var(--ease-micro) or var(--ease-panel)",
    ]
  )
})

test("tokens, motion utilities, loops, instant changes and the reduced-motion rule stay quiet", () => {
  const clean = [
    [
      ".x { transition: opacity var(--duration-micro) var(--ease-micro), scale var(--duration-micro) var(--ease-micro); }",
      "apps/web/src/styles/paper.css",
    ],
    [
      'export const a = "motion-pop motion-press transition-colors"',
      "packages/ui/src/components/popover.tsx",
    ],
    [
      'export const a = "transition-[box-shadow] duration-(--duration-micro) ease-(--ease-micro)"',
      "packages/ui/src/components/kanban.tsx",
    ],
    [
      ".spin { animation: spin 800ms linear infinite; }",
      "apps/web/src/styles/coach.css",
    ],
    [
      'export const a = "animate-spin duration-700 ease-linear"',
      "packages/ui/src/components/spinner.tsx",
    ],
    [".x { transition: none; }", "apps/web/src/styles/paper.css"],
    [".x { transition-duration: 0ms; }", "apps/web/src/styles/paper.css"],
    [
      "@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-property: opacity, color !important; } }",
      "packages/ui/src/styles/globals.css",
    ],
    [
      "@theme inline { --duration-micro: 150ms; --ease-micro: cubic-bezier(0.22, 1, 0.36, 1); }",
      "packages/ui/src/styles/globals.css",
    ],
    [
      "@utility motion-collapse { transition-property: height, opacity; }",
      "packages/ui/src/styles/globals.css",
    ],
    [
      'export const a = "transition-[bottom,right,transform]! duration-(--duration-panel)!"',
      "packages/ui/src/components/sonner.tsx",
    ],
    [
      'export const S = () => <div style={{ transition: "opacity var(--duration-micro) var(--ease-micro)" }} />',
      "apps/web/src/features/apply/apply-board.tsx",
    ],
    [
      'export const go = (el: Element) => el.animate([{ opacity: 0 }], motionToken("micro"))',
      "packages/ui/src/lib/motion.ts",
    ],
    [
      'export const copy = "Ease into your search"',
      "apps/web/src/features/apply/apply-board.tsx",
    ],
    [
      ".x { width: 280px; padding: 12px; top: 0; }",
      "apps/web/src/styles/paper.css",
    ],
    [".x:hover { color: red; }", "apps/web/src/styles/paper.css"],
  ]
  for (const [source, file] of clean)
    assert.deepEqual(
      motionTokenProblems(source, file),
      [],
      `${file}: ${source}`
    )
})

const scannedFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      ...SCANNED_ROOTS,
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(scannedFile)
    .filter((file) => existsSync(path.join(root, file)))

test("the app and the kit hold exactly the known hand-written motion, and the ratchet only shrinks", () => {
  const known = JSON.parse(readFileSync(path.join(root, KNOWN_FILE), "utf8"))
  const counts = countsByFile(
    scannedFiles().flatMap((file) =>
      motionTokenProblems(readFileSync(path.join(root, file), "utf8"), file)
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
    "new hand-written motion: use the tokens or a motion-* utility"
  )
  const shrank = Object.entries(known)
    .filter(([file, count]) => (counts[file] ?? 0) < count)
    .map(
      ([file, count]) => `${file}: ${counts[file] ?? 0} found, ${count} known`
    )
  assert.deepEqual(
    shrank,
    [],
    `fixed motion: lower or remove its entry in ${KNOWN_FILE}`
  )
  assert.deepEqual(
    Object.keys(known),
    Object.keys(known).sort(),
    `${KNOWN_FILE} stays sorted`
  )
})
