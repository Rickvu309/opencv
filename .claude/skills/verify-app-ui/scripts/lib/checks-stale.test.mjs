// A check judges every part it can find: a found FAIL wins, a part it cannot locate is STALE. Run: node --test .claude/skills/verify-app-ui/scripts/lib
import assert from "node:assert/strict"
import test from "node:test"

import { motionChecks } from "./checks-source.mjs"
import { coachErrorCheck } from "./checks-content.mjs"
import { keyboardPrimaryCheck, primaryButtonCheck } from "./checks-primary.mjs"
import { boardLanes } from "./checks-stages.mjs"
import { WIDE_PAGES, sidewaysScroll } from "./checks-scroll.mjs"
import {
  judged,
  result,
  scanProblem,
  sourceFiles,
  stale,
  summarize,
} from "./check-util.mjs"

const scan = (...dirs) => sourceFiles(dirs)

test("sourceFiles names a missing folder and still reads the others", () => {
  const found = scan(
    "apps/web/src/features/command-palette",
    "apps/web/src/features/gone"
  )
  assert.deepEqual(found.missing, ["apps/web/src/features/gone"])
  assert.ok(found.files.length > 0)
  assert.match(scanProblem(found), /missing: apps\/web\/src\/features\/gone/)
  assert.equal(scanProblem(scan("apps/web/src/features/command-palette")), null)
  assert.match(scanProblem({ files: [], missing: [] }), /zero files/)
})

const snap = { durations: {}, durationSamples: [], redOutsideAlert: [] }
const surfaces = (over = {}) =>
  Object.fromEntries(
    ["coach", "paper", "cv", "apply", "pitch"].map((k) => [k, over[k] ?? snap])
  )
const GONE = ["apps/web/src/features/gone"]
const PALETTE = "apps/web/src/features/command-palette"
const ALERTING = "apps/web/src/features/auth/sign-in-screen.tsx"
const motion = (d, shot = snap, options = {}) => {
  const out = motionChecks(
    { reduced: {}, coachError: { alerts: [], stubHits: 1 }, ...d },
    { allSnaps: [shot], screens: surfaces() },
    { banner: ALERTING, ...options }
  )
  return Object.fromEntries(out.map((r) => [r.id, r]))
}

test("source checks go STALE on a missing folder, not PASS", () => {
  const out = motion({}, snap, { dirs: GONE })
  assert.equal(out["24"].status, "STALE")
  assert.equal(out["26"].status, "STALE")
  assert.match(out["24"].measured, /features\/gone/)
  assert.equal(out["25"].status, "PASS")
})

test("24: a computed off-token duration FAILs even when a source folder is missing", () => {
  const shot = { ...snap, durations: { "500ms": 3 }, durationSamples: [] }
  const out = motion({}, shot, { dirs: GONE })
  assert.equal(out["24"].status, "FAIL")
  assert.match(out["24"].measured, /500ms x3.*not judged: source scan/)
  assert.equal(out["26"].status, "STALE")
})

test("25: reduced-motion motion FAILs even when the palette folder is missing; missing alone is STALE", () => {
  const reduced = {
    coach: {
      durations: { "500ms": 1 },
      runningAnimations: 0,
      scrollBehavior: "auto",
    },
  }
  const failing = motion({ reduced }, snap, { paletteDir: GONE[0] })
  assert.equal(failing["25"].status, "FAIL")
  assert.match(failing["25"].measured, /coach:500ms.*not judged/)
  assert.equal(motion({}, snap, { paletteDir: GONE[0] })["25"].status, "STALE")
  assert.equal(motion({}, snap, { paletteDir: PALETTE })["25"].status, "PASS")
})

test("27: a silent Coach stub makes only the Coach part unjudged", () => {
  const quiet = { coachError: { alerts: [], stubHits: 0 } }
  const clean = motion(quiet)
  assert.equal(clean["27"].status, "STALE")
  assert.match(
    clean["27"].measured,
    /Coach error \(the scenario stub never fired\)/
  )
  const red = motionChecks(
    { reduced: {}, ...quiet },
    {
      allSnaps: [snap],
      screens: surfaces({ coach: { ...snap, redOutsideAlert: ["Failed"] } }),
    },
    { banner: ALERTING }
  ).find((r) => r.id === "27")
  assert.equal(red.status, "FAIL")
  const noAlert = motion(quiet, snap, {
    banner: "apps/web/src/features/paper/paper-editor-conflict-banner.tsx",
  })
  assert.equal(noAlert["27"].status, "FAIL")
  assert.match(noAlert["27"].measured, /role=alert: false/)
})

test("27: a missing banner file alone is STALE, and a found Coach FAIL still FAILs", () => {
  const missing = { banner: `${GONE[0]}.tsx` }
  const shown = {
    coachError: { alerts: ["Something went wrong"], stubHits: 1 },
  }
  assert.equal(motion(shown, snap, missing)["27"].status, "STALE")
  const hidden = { coachError: { alerts: [], stubHits: 1 } }
  assert.equal(motion(hidden, snap, missing)["27"].status, "FAIL")
})

test("judged: a found FAIL wins over a missing part, a missing part alone is STALE", () => {
  assert.equal(judged("01", "a", "r", false, "bad", ["x"]).status, "FAIL")
  assert.match(
    judged("01", "a", "r", false, "bad", ["x"]).measured,
    /not judged: x/
  )
  assert.equal(judged("01", "a", "r", true, "ok", ["x"]).status, "STALE")
  assert.equal(judged("01", "a", "r", true, "ok", [null, ""]).status, "PASS")
})

const buttonSnap = (
  buttons,
  primaryMarks = buttons.some((b) => b.primary)
) => ({
  buttons,
  primaryMarks: primaryMarks ? 1 : 0,
})
const tabsOf = (d) => ({ reached: d })
const marked = (label, h) => ({ label, h, primary: true })
test("28: a too-small button FAILs although another surface has no marker", () => {
  const d = {
    apply: buttonSnap([marked("New job", 28)]),
    paper: buttonSnap([{ label: "New", h: 32 }]),
    pitchEdit: buttonSnap([marked("Get early access", 40)]),
  }
  const out = primaryButtonCheck(d)
  assert.equal(out.status, "FAIL")
  assert.match(out.measured, /apply "New job" 28px/)
  assert.match(out.measured, /not judged: paper \(no \[data-primary-action\]/)
  d.apply = buttonSnap([marked("New job", 32)])
  assert.equal(primaryButtonCheck(d).status, "STALE")
  d.paper = buttonSnap([marked("Create", 32)])
  assert.equal(primaryButtonCheck(d).status, "PASS")
})

test("28 and 32 follow the marker, not the label", () => {
  const d = {
    apply: buttonSnap([marked("Renamed", 36)]),
    paper: buttonSnap([marked("Whatever", 36)]),
    pitchEdit: buttonSnap([marked("Else", 36)]),
    coach: buttonSnap([], true),
    pitch: buttonSnap([marked("Else", 36)]),
    tabs: {
      coach: tabsOf(5),
      paper: tabsOf(9),
      apply: tabsOf(12),
      pitch: tabsOf(7),
    },
  }
  assert.equal(primaryButtonCheck(d).status, "PASS")
  assert.equal(keyboardPrimaryCheck(d).status, "PASS")
})

test("32: a surface past 30 Tab presses FAILs although another has no marker", () => {
  const d = {
    coach: buttonSnap([], false),
    paper: buttonSnap([marked("New")]),
    apply: buttonSnap([marked("New job")]),
    tabs: { coach: tabsOf(null), paper: tabsOf(45), apply: tabsOf(12) },
  }
  const out = keyboardPrimaryCheck(d)
  assert.equal(out.status, "FAIL")
  assert.match(out.measured, /not judged: coach \(no \[data-primary-action\]/)
  d.tabs.paper = tabsOf(12)
  assert.equal(keyboardPrimaryCheck(d).status, "STALE")
})

test("32: a marked surface Tab never reaches is a FAIL, not STALE", () => {
  const d = {
    coach: buttonSnap([], true),
    tabs: { coach: { reached: null } },
  }
  assert.equal(keyboardPrimaryCheck(d).status, "FAIL")
})

test("28 and 32: two visible primary actions on one screen FAIL and name the count", () => {
  const two = { ...buttonSnap([marked("Add", 36)]), primaryMarks: 2 }
  const d = {
    apply: buttonSnap([marked("New job", 36)]),
    paper: two,
    pitchEdit: buttonSnap([marked("Get early access", 36)]),
    coach: buttonSnap([], true),
    tabs: { coach: tabsOf(5), paper: tabsOf(9) },
  }
  const size = primaryButtonCheck(d)
  assert.equal(size.status, "FAIL")
  assert.match(size.measured, /paper has 2 visible \[data-primary-action\]/)
  const keys = keyboardPrimaryCheck(d)
  assert.equal(keys.status, "FAIL")
  assert.match(keys.measured, /paper has 2 visible \[data-primary-action\]/)
})

test("board lanes follow the stage list, not pinned words", () => {
  const lane = (stage, heading) => ({ stage, heading })
  const full = {
    lanes: ["saved", "applied", "interview", "offer"].map((s) => lane(s, s)),
  }
  assert.deepEqual(
    boardLanes(full, ["saved", "applied", "interview", "offer"]).missing,
    []
  )
  const five = boardLanes(full, [
    "saved",
    "applied",
    "interview",
    "offer",
    "ghosted",
  ])
  assert.deepEqual(five.missing, ["ghosted"])
  const closed = boardLanes(
    { lanes: [...full.lanes, lane("closed", "Closed")] },
    ["saved"]
  )
  assert.equal(closed.hiddenShown, true)
  assert.match(boardLanes(full, null).unread, /JOB_STAGES not readable/)
  assert.deepEqual(
    boardLanes({ lanes: [lane("saved", "Saved"), lane("applied", "Saved")] }, [
      "saved",
      "applied",
    ]).misnamed,
    [lane("applied", "Saved")]
  )
})

const alertSnap = (text, stubHits) => ({ alerts: [text], stubHits })

test("04 is STALE when an intercept answered nothing", () => {
  const sentence = "Coach could not answer. Try again."
  for (const hits of [
    [0, 2],
    [2, 0],
    [undefined, 2],
  ]) {
    const found = coachErrorCheck({
      coachError: alertSnap(sentence, hits[0]),
      coachNet: alertSnap(sentence, hits[1]),
    })
    assert.equal(found.status, "STALE", String(hits))
    assert.match(found.measured, /never fired/)
  }
})

test("04 judges the part whose stub fired: a raw 404 message FAILs although the net stub is silent", () => {
  const found = coachErrorCheck({
    coachError: alertSnap("User not found.", 1),
    coachNet: alertSnap("", 0),
  })
  assert.equal(found.status, "FAIL")
  assert.match(found.measured, /raw api message.*refused connection not judged/)
})

test("04 still judges the app once both stubs fired", () => {
  const sentence = "Coach could not answer. Try again."
  const pass = coachErrorCheck({
    coachError: alertSnap(sentence, 1),
    coachNet: alertSnap(sentence, 1),
  })
  assert.equal(pass.status, "PASS")
  const raw = coachErrorCheck({
    coachError: alertSnap("User not found.", 1),
    coachNet: alertSnap(sentence, 1),
  })
  assert.equal(raw.status, "FAIL")
})

test("summary and exit code: STALE is 3, FAIL is 1, all PASS is 0", () => {
  const pass = result("01", "a", true, "ok", "rule")
  const fail = result("02", "b", false, "bad", "rule")
  const gone = stale("03", "c", "folder missing", "rule")
  const mixed = summarize([pass, fail, gone])
  assert.equal(mixed.exit, 3)
  assert.equal(mixed.lines.at(-1), "1 PASS, 1 FAIL, 1 STALE: 02 03")
  assert.equal(mixed.lines[2], "STALE 03 c: folder missing | rule: rule")
  assert.equal(summarize([pass, fail]).exit, 1)
  assert.equal(
    summarize([pass, fail]).lines.at(-1),
    "1 PASS, 1 FAIL, 0 STALE: 02"
  )
  const clean = summarize([pass])
  assert.equal(clean.exit, 0)
  assert.equal(clean.lines.at(-1), "1 PASS, 0 FAIL, 0 STALE")
})

const fits = { docScroll: { sw: 1440, cw: 1440 } }
const toured = () => ({
  ...Object.fromEntries(WIDE_PAGES.map((k) => [k, fits])),
  reduced: { coach: fits },
  mobile: { apply: { docScroll: { sw: 390, cw: 390 } } },
  settingsMobile: { docScroll: { sw: 390, cw: 390 } },
})
test("45: a page wider than its window FAILs, at 1440 and at 390; every page fitting PASSes", () => {
  assert.equal(sidewaysScroll(toured()).status, "PASS")
  const wide = toured()
  wide.apply = { docScroll: { sw: 1500, cw: 1440 } }
  const out = sidewaysScroll(wide)
  assert.equal(out.status, "FAIL")
  assert.match(out.measured, /apply 1440 1500>1440/)
  const phone = toured()
  phone.mobile.apply = { docScroll: { sw: 520, cw: 390 } }
  assert.match(sidewaysScroll(phone).measured, /apply 390 520>390/)
  assert.equal(sidewaysScroll(phone).status, "FAIL")
})

test("45: a snapshot with no scroll size is STALE, and a found FAIL still wins", () => {
  const missing = toured()
  delete missing.pitchEdit
  const out = sidewaysScroll(missing)
  assert.equal(out.status, "STALE")
  assert.match(out.measured, /no scroll size for pitchEdit 1440/)
  missing.mobile.apply = { docScroll: { sw: 520, cw: 390 } }
  assert.equal(sidewaysScroll(missing).status, "FAIL")
})
