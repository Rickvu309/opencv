import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  judgeRoutes,
  spills,
} from "../.claude/skills/verify-app-ui/scripts/lib/overflow-390.mjs"
import {
  EMAIL,
  EVENING,
  MARK,
  UNBROKEN,
  routesFor,
} from "../.claude/skills/verify-app-ui/scripts/lib/worst-case-seed.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const read = (file) => readFileSync(path.join(root, file), "utf8")

test("a page wider than the phone, or a visible text box past its parent, spills", () => {
  assert.equal(
    spills({ scrollWidth: 500, innerWidth: 390, nodes: [] }).length,
    1
  )
  assert.equal(
    spills({
      scrollWidth: 390,
      innerWidth: 390,
      nodes: [
        {
          overflow: "visible",
          left: 0,
          right: 420,
          parentLeft: 0,
          parentRight: 390,
        },
      ],
    }).length,
    1
  )
})

test("a text box that scrolls or stays inside its parent does not spill", () => {
  assert.deepEqual(
    spills({
      scrollWidth: 390,
      innerWidth: 390,
      nodes: [
        {
          overflow: "hidden",
          left: 0,
          right: 900,
          parentLeft: 0,
          parentRight: 100,
        },
        {
          overflow: "visible",
          left: 8,
          right: 100,
          parentLeft: 0,
          parentRight: 120,
        },
        {
          overflow: "visible",
          parentOverflow: "auto",
          left: 0,
          right: 900,
          parentLeft: 0,
          parentRight: 100,
        },
      ],
    }),
    []
  )
})

test("a spill with no pending entry fails, and a pending spill that is gone fails", () => {
  const today = "2026-11-03"
  const spilling = { id: "apply", mark: true, marked: true, spills: 2 }
  assert.match(
    judgeRoutes([spilling], [], today).join("\n"),
    /apply spills and is not pending/
  )
  assert.deepEqual(
    judgeRoutes(
      [spilling],
      [{ id: "apply", issue: "#1034", expires: "2026-12-03" }],
      today
    ),
    []
  )
  assert.match(
    judgeRoutes(
      [{ id: "apply", mark: true, marked: true, spills: 0 }],
      [{ id: "apply", issue: "#1034", expires: "2026-12-03" }],
      today
    ).join("\n"),
    /no longer spills/
  )
  assert.match(
    judgeRoutes(
      [spilling],
      [{ id: "apply", issue: "#1034", expires: "2026-11-02" }],
      today
    ).join("\n"),
    /expired/
  )
  assert.match(
    judgeRoutes(
      [{ id: "paper", mark: true, marked: false, spills: 0 }],
      [],
      today
    ).join("\n"),
    /did not show the long value/
  )
  assert.match(
    judgeRoutes(
      [],
      [{ id: "coach", issue: "#1034", expires: "2026-12-03" }],
      today
    ).join("\n"),
    /was not measured/
  )
})

test("the worst-case seed is an unbroken 200-character value, a 40-character email and an evening event", () => {
  assert.equal(UNBROKEN.length, 200)
  assert.equal(UNBROKEN.includes(" "), false)
  assert.equal(EMAIL.length, 40)
  assert.equal(EMAIL.includes("@"), true)
  assert.equal(MARK, UNBROKEN.slice(0, 40))
  assert.equal(EVENING, "2026-11-03T12:00:00.000Z")
  const ids = routesFor("job").map((route) => route.id)
  assert.deepEqual(ids, [
    "jobs",
    "inbox",
    "proofs",
    "paper",
    "apply",
    "apply-detail",
    "apply-filters",
    "apply-calendar",
    "pitch",
    "settings",
    "coach",
  ])
})

test("pending overflow routes name an issue and a date", () => {
  const pending = JSON.parse(
    readFileSync(path.join(root, "scripts/overflow-390.pending.json"), "utf8")
  )
  const known = new Set(routesFor("job").map((route) => route.id))
  for (const entry of pending) {
    assert.equal(known.has(entry.id), true, entry.id)
    assert.match(entry.issue, /^#\d+$/)
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/)
  }
})

const locks = [
  [
    "apps/web/src/features/apply/apply-detail-parts.tsx",
    "min-w-0 text-start wrap-break-word",
  ],
  [
    "apps/web/src/features/apply/apply-detail-document.tsx",
    "break-words whitespace-pre-wrap",
  ],
  [
    "apps/web/src/features/apply/apply-toolbar.tsx",
    "min-w-0 font-medium break-words",
  ],
  [
    "apps/web/src/features/coach/coach-workspace.tsx",
    "min-w-0 [overflow-wrap:anywhere]",
  ],
  [
    "apps/web/src/features/auth/session-expired-dialog.tsx",
    "min-w-0 [overflow-wrap:anywhere] whitespace-normal",
  ],
]

test("the five phone overflow fixes stay in the source", () => {
  for (const [file, snippet] of locks)
    assert.equal(read(file).includes(snippet), true, file)
})
