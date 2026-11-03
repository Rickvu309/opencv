import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  judgeRoutes,
  offScreen,
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

test("a box below the fold is measured, and a box fully to the right of the phone is not", () => {
  assert.equal(
    offScreen(
      { width: 100, height: 20, left: 8, right: 108, top: 900, bottom: 920 },
      390
    ),
    false
  )
  assert.equal(
    offScreen(
      { width: 80, height: 20, left: 400, right: 480, top: 0, bottom: 20 },
      390
    ),
    true
  )
})

test("a spill with no pending entry fails, and a second spill on a listed route still fails", () => {
  const today = "2026-11-03"
  const title = { kind: "box", selector: "h1", text: MARK }
  const prep = {
    kind: "box",
    selector: '[data-slot="checklist-item"] span',
    text: MARK,
  }
  const listed = {
    route: "apply-detail",
    selector: "h1",
    text: MARK,
    issue: "#1037",
    expires: "2026-12-01",
  }
  const page = {
    id: "apply-detail",
    needle: MARK,
    marked: true,
    hits: [title],
  }
  assert.match(
    judgeRoutes([{ ...page, hits: [title] }], [], today).join("\n"),
    /h1 spills and is not pending/
  )
  assert.deepEqual(judgeRoutes([page], [listed], today), [])
  assert.match(
    judgeRoutes([{ ...page, hits: [title, prep] }], [listed], today).join("\n"),
    /checklist-item.*spills and is not pending/
  )
  assert.match(
    judgeRoutes([{ ...page, hits: [] }], [listed], today).join("\n"),
    /no longer spills/
  )
  assert.match(
    judgeRoutes([page], [{ ...listed, expires: "2026-11-02" }], today).join(
      "\n"
    ),
    /expired/
  )
  assert.match(
    judgeRoutes(
      [{ id: "paper", needle: MARK, marked: false, hits: [] }],
      [],
      today
    ).join("\n"),
    /did not show the long value/
  )
  assert.match(judgeRoutes([], [listed], today).join("\n"), /was not measured/)
  assert.match(
    judgeRoutes(
      [
        {
          id: "apply",
          needle: MARK,
          marked: true,
          hits: [{ kind: "document", scrollWidth: 500, innerWidth: 390 }],
        },
      ],
      [],
      today
    ).join("\n"),
    /wider than the phone/
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
    "apply-calendar-month",
    "pitch",
    "settings",
    "coach",
    "session-expired",
  ])
  const month = routesFor("job").find(
    (route) => route.id === "apply-calendar-month"
  )
  const expired = routesFor("job").find(
    (route) => route.id === "session-expired"
  )
  assert.equal(month.path, "/apply?view=calendar&span=month")
  assert.equal(month.needle, MARK)
  assert.equal(expired.needle, EMAIL)
  assert.equal(expired.path, "/apply")
  assert.equal(expired.openExpired, true)
})

test("pending overflow entries name one element, an issue and a date", () => {
  const pending = JSON.parse(
    readFileSync(path.join(root, "scripts/overflow-390.pending.json"), "utf8")
  )
  const known = new Set(routesFor("job").map((route) => route.id))
  for (const entry of pending) {
    assert.equal(known.has(entry.route), true, entry.route)
    assert.equal(entry.selector.length > 0, true, entry.route)
    assert.equal(entry.text, MARK, entry.route)
    assert.match(entry.issue, /^#\d+$/)
    assert.notEqual(entry.issue, "#1034")
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
