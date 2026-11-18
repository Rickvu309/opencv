import assert from "node:assert/strict"
import test from "node:test"

import { GRID } from "../../../packages/ui/src/lib/viewport-grid.ts"
import { failureLine, summaryLine, sweepScreen } from "./runner.mjs"

const quietBoxes = (viewport) => ({
  modalOpen: false,
  boxes: [
    {
      kind: "document",
      name: "page",
      width: viewport.width,
      height: viewport.height,
    },
  ],
})

function stubSession(over = {}) {
  const seen = { sizes: [], closed: false }
  let current = { width: 1440, height: 900 }
  return {
    seen,
    runSteps: async () => null,
    settle: async () => {},
    idle: async () => {},
    requests: () => [
      { method: "GET", url: "/api/paper", phase: "load", at: 0 },
    ],
    resize: async (viewport) => {
      current = viewport
      seen.sizes.push(`${viewport.width}x${viewport.height}`)
    },
    measure: async () => quietBoxes(current),
    escapeReturnsFocus: async () => ({ checked: false }),
    higSample: async () => ({
      sample: { contrast: [], clips: [], rings: [], motion: [] },
      baseShot: "/shots/hig.png",
      clipShot: null,
    }),
    focusRings: async () => ({ rings: [], shot: "/shots/focus.png" }),
    consoleErrors: () => [],
    screenshot: async (name) => `/shots/${name}.png`,
    close: async () => {
      seen.closed = true
    },
    ...over,
  }
}

const worldWith = (session) => ({
  now: () => 0,
  openScreen: async () => session,
})
const screen = { id: "paper-home", route: "/paper", steps: [] }

test("a quiet screen is measured at every grid size and passes every rule", async () => {
  const session = stubSession()
  const cases = await sweepScreen(worldWith(session), screen, GRID)
  assert.deepEqual(
    cases.filter((item) => !item.ok),
    []
  )
  assert.deepEqual(
    session.seen.sizes.slice(0, 10),
    GRID.map((size) => `${size.width}x${size.height}`)
  )
  assert.deepEqual(session.seen.sizes.slice(10), [
    "1440x900",
    "390x844",
    "1440x900",
  ])
  assert.equal(session.seen.closed, true)
  assert.match(
    summaryLine("paper-home", cases),
    /^paper-home: opens, 10\/10 sizes fit, no layer to close, 1 requests, idle 0 in 3 s, ok, 0 s$/
  )
})

test("a recipe step that fails stops the sweep with the step and a screenshot", async () => {
  const session = stubSession({
    runSteps: async () =>
      'step 3 {"waitFor":{"text":"Exchange term, Lyon"}} failed: Timeout 20000ms exceeded.',
  })
  const cases = await sweepScreen(worldWith(session), screen, GRID)
  assert.equal(cases.length, 1)
  assert.equal(
    failureLine(cases[0]),
    'FAIL paper-home at 1440x900: does not open: step 3 {"waitFor":{"text":"Exchange term, Lyon"}} failed: Timeout 20000ms exceeded., screenshot /shots/paper-home-open.png, repro: node scripts/ui.mjs sweep screen paper-home'
  )
  assert.equal(session.seen.closed, true)
})

test("a box that does not fit at one size names the size, the rule, the measure and a repro for that size", async () => {
  const session = stubSession({
    measure: async () => ({
      modalOpen: true,
      boxes: [
        {
          kind: "surface",
          name: 'dialog "New CV"',
          x: 8,
          y: 0,
          width: 374,
          height: 878,
          pinned: true,
          reachable: false,
        },
      ],
    }),
  })
  const cases = await sweepScreen(worldWith(session), screen, [
    { width: 390, height: 844 },
  ])
  const bad = cases.find((item) => item.rule === "fits")
  assert.equal(
    failureLine(bad),
    'FAIL paper-home at 390x844: does not fit: dialog "New CV" runs off the window and cannot be scrolled into view: bottom 878 > 844, screenshot /shots/paper-home-390x844.png, repro: node scripts/ui.mjs sweep screen paper-home --size 390x844'
  )
})

test("focus that does not return to the opener after Escape fails; focus that returns passes", async () => {
  const lost = await sweepScreen(
    worldWith(
      stubSession({
        escapeReturnsFocus: async () => ({
          checked: true,
          problem: 'focus went to body, not to button "New"',
        }),
      })
    ),
    screen,
    []
  )
  assert.equal(
    lost.find((item) => item.rule === "focus").problem,
    'focus after Escape: focus went to body, not to button "New"'
  )
  const kept = await sweepScreen(
    worldWith(
      stubSession({ escapeReturnsFocus: async () => ({ checked: true }) })
    ),
    screen,
    []
  )
  assert.equal(kept.find((item) => item.rule === "focus").ok, true)
})

test("a request storm while idle and a console error each fail as their own rule", async () => {
  const cases = await sweepScreen(
    worldWith(
      stubSession({
        requests: () =>
          Array.from({ length: 5 }, () => ({
            method: "GET",
            url: "/api/paper",
            phase: "idle",
            at: 0,
          })),
        consoleErrors: () => [
          "Failed to load resource: the server responded with a status of 404 (Not Found)",
        ],
      })
    ),
    screen,
    []
  )
  assert.deepEqual(
    cases.filter((item) => !item.ok).map((item) => item.rule),
    ["requests", "console"]
  )
})

test("guideline findings are reported with their source and screenshot but never fail the sweep", async () => {
  const session = stubSession({
    higSample: async () => ({
      sample: {
        contrast: [
          {
            name: '"Upload"',
            kind: "text",
            x: 10,
            y: 20,
            width: 60,
            height: 16,
            fontSize: 13,
            fontWeight: 400,
            color: [170, 170, 170, 1],
            layers: [[255, 255, 255, 1]],
            overImage: false,
          },
        ],
        clips: [],
        rings: [],
        motion: [],
      },
      baseShot: "/shots/hig.png",
      clipShot: null,
    }),
    focusRings: async () => ({
      rings: [
        {
          name: 'switch "Email"',
          ring: false,
          x: 0,
          y: 0,
          width: 32,
          height: 18,
        },
      ],
      shot: "/shots/focus.png",
    }),
  })
  const cases = await sweepScreen(worldWith(session), screen, GRID)
  assert.deepEqual(
    cases.filter((item) => !item.ok),
    []
  )
  const contrast = cases.filter(
    (item) => item.rule === "hig-contrast" && item.findings.length
  )
  assert.deepEqual(
    contrast.map((item) => item.size),
    ["1440x900", "390x844"]
  )
  assert.equal(contrast[0].shot, "/shots/hig.png")
  assert.equal(
    contrast[0].source.url,
    "https://developer.apple.com/design/human-interface-guidelines/accessibility"
  )
  assert.match(
    contrast[0].problem,
    /"Upload" 13px\/400 text #aaaaaa on #ffffff is 2\.32:1, needs 4\.5:1/
  )
  const ring = cases.find((item) => item.rule === "hig-focus-ring")
  assert.equal(ring.size, "1440x900")
  assert.equal(ring.findings.length, 1)
  assert.match(summaryLine("paper-home", cases), /, ok, 3 HIG findings, 0 s$/)
})
