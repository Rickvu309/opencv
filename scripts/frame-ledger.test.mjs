import assert from "node:assert/strict"
import { test } from "node:test"

import {
  detect,
  driverRun,
  entryProblems,
  frameProblems,
  layoutImports,
  ledgerProblems,
  pendingFramesIn,
  readTree,
  screenRuns,
} from "./lib/frame-ledger.mjs"

const MISTAKE = `const PENDING_FRAMES: Record<string, { issue: number; expires: string }> = {
  Cs3hj: { issue: 498, expires: "2026-12-31" },
  FUipv: { issue: 498, expires: "2026-12-31" },
  ISnTZ: { issue: 498, expires: "2026-12-31" },
}
`

const SCREENS = `const penLayout = await run(
    "pen-layout",
    [join(scripts, "verify-pen-layout.mjs")],
  )
  const apply = await run(
    "apply-pen",
    [join(scripts, "verify-apply-pen.mjs")],
  )
const EXTERNAL = [
  { id: "auth-code", script: "verify-auth-code.mjs", style: "port" },
  {
    id: "letter-start-unreadable",
    script: "verify-letter-start.mjs",
    style: "port",
    extra: ["--state", "unreadable"],
  },
]`

const frames = [
  { id: "w7zeGR", name: "Landing (Linear layout)" },
  { id: "aLOFO", name: "W9.3 Board" },
  { id: "yGwdJ", name: "W1.2 Enter code" },
]

const checks = (overrides = {}) => ({
  imported: new Set(),
  runs: screenRuns(SCREENS),
  skipped: new Set(),
  ...overrides,
})

test("a pending list that grows past its pinned count fires", () => {
  assert.equal(detect(MISTAKE, "x.ts", { pendingFrames: 2 }).length, 1)
  assert.match(detect(MISTAKE, "x.ts", { pendingFrames: 2 })[0], /only shrinks/)
})

test("a pending list that shrinks without lowering its count fires", () => {
  assert.match(
    detect(MISTAKE, "x.ts", { pendingFrames: 4 })[0],
    /Lower "pendingFrames" .* from 4 to 3/
  )
})

test("a pending list at its pinned count is quiet", () => {
  assert.deepEqual(detect(MISTAKE, "x.ts", { pendingFrames: 3 }), [])
})

test("pending entries are read with their issue and expiry", () => {
  assert.deepEqual(pendingFramesIn(MISTAKE)[0], {
    id: "Cs3hj",
    issue: 498,
    expires: "2026-12-31",
  })
  assert.deepEqual(pendingFramesIn("  bad: {},\n").length, 0)
})

test("a signed-in frame covered only by a snapshot fires; a marketing frame does not", () => {
  const problems = frameProblems({
    frames,
    pending: [],
    layoutPending: [],
    layouts: [],
    checks: checks(),
  })
  assert.equal(problems.length, 2)
  assert.match(problems[0], /W9\.3 Board \(aLOFO\) counts as covered/)
})

test("a layout a test imports, or one the screens job runs, is a check", () => {
  assert.deepEqual(
    frameProblems({
      frames,
      pending: [],
      layoutPending: [],
      layouts: [
        {
          file: "a/w9-3.layout.json",
          frameId: "aLOFO",
          driver: "verify-apply-pen",
        },
        { file: "a/code.layout.json", frameId: "yGwdJ", driver: null },
      ],
      checks: checks({ imported: new Set(["a/code.layout.json"]) }),
    }),
    []
  )
})

test("a layout whose screen check is skipped, or that no check runs, is not a check", () => {
  const layouts = [
    {
      file: "a/code.layout.json",
      frameId: "yGwdJ",
      driver: ".claude/skills/verify-app-ui/scripts/verify-auth-code.mjs",
    },
    {
      file: "a/w9-3.layout.json",
      frameId: "aLOFO",
      driver: "scripts/verify-coach-home-pane.mjs",
    },
  ]
  const problems = frameProblems({
    frames,
    pending: [],
    layoutPending: [],
    layouts,
    checks: checks({ skipped: new Set(["auth-code"]) }),
  })
  assert.equal(problems.length, 2)
})

test("a driver matches its screen run by script and extra arguments", () => {
  const runs = screenRuns(SCREENS)
  assert.equal(driverRun(null, runs).id, "pen-layout")
  assert.equal(
    driverRun("x/verify-letter-start.mjs --state unreadable", runs).id,
    "letter-start-unreadable"
  )
  assert.equal(driverRun("x/verify-letter-start.mjs", runs), null)
})

test("a waiting frame that is checked now is stale, and a frame in both lists fires", () => {
  const problems = frameProblems({
    frames,
    pending: [{ id: "aLOFO", issue: 1, expires: "2026-12-01" }],
    layoutPending: [
      { id: "aLOFO", issue: 1, expires: "2026-12-01" },
      { id: "yGwdJ", issue: 1, expires: "2026-12-01" },
    ],
    layouts: [{ file: "a/code.layout.json", frameId: "yGwdJ", driver: null }],
    checks: checks(),
  })
  assert.equal(problems.length, 2)
  assert.match(problems[0], /also in PENDING_FRAMES/)
  assert.match(problems[1], /yGwdJ is checked now/)
})

test("a pending entry with no issue, no expiry, an unknown frame or a past expiry fires", () => {
  const problems = entryProblems({
    list: "layoutPending",
    entries: [
      { id: "aLOFO", issue: null, expires: "2026-12-01" },
      { id: "yGwdJ", issue: 5, expires: null },
      { id: "gone", issue: 5, expires: "2026-12-01" },
      { id: "w7zeGR", issue: 5, expires: "2026-11-02" },
      { id: "w7zeGR", issue: 5, expires: "2026-11-03" },
    ],
    frameIds: new Set(frames.map((frame) => frame.id)),
    today: "2026-11-03",
  })
  assert.deepEqual(
    problems.map((problem) => problem.replace(/^.*?: /, "")),
    [
      "aLOFO names no issue.",
      "yGwdJ has no expiry date (YYYY-MM-DD).",
      "gone is not a release frame in apps/web/src/test/design-frames.json.",
      "w7zeGR is listed twice.",
      "w7zeGR expired on 2026-11-02. Build its layout check (#5) and delete the entry.",
    ]
  )
})

test("a test's relative and alias layout imports resolve to repo paths", () => {
  assert.deepEqual(
    layoutImports(
      "apps/web/src/features/paper/p.test.tsx",
      'import a from "./design/a.layout.json"\nimport b from "@/features/x/b.layout.json"'
    ),
    [
      "apps/web/src/features/paper/design/a.layout.json",
      "apps/web/src/features/x/b.layout.json",
    ]
  )
})

test("every signed-in release frame on this tree has a layout check or a dated pending entry, and both lists match their pinned counts", () => {
  assert.deepEqual(
    ledgerProblems(readTree(), new Date().toISOString().slice(0, 10)),
    []
  )
})
