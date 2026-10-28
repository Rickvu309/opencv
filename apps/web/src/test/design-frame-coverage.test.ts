// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import manifest from "./design-frames.json"

// Every first-release frame in design/opencv.pen needs a committed snapshot
// (scripts/pen-snapshot.mjs) that a test reads, so a screen that drifts from
// its frame fails a test. A frame not built from the pen yet waits here with
// its issue and an expiry date. Remove the entry when its parity test lands.
const PENDING_FRAMES: Record<string, { issue: number; expires: string }> = {
  Cs3hj: { issue: 498, expires: "2026-12-31" }, // Blog (Linear layout)
  EKv2D: { issue: 498, expires: "2026-12-31" }, // Blog post (Linear layout)
  yGwdJ: { issue: 498, expires: "2026-12-31" }, // W1.2 Enter code
  iAwJ7: { issue: 498, expires: "2026-12-31" }, // W1.3 Verifying
  b1m7SA: { issue: 498, expires: "2026-12-31" }, // W1.4 Code wrong or expired
  NAXQk: { issue: 498, expires: "2026-12-31" }, // W1.5 Welcome
  DhG87: { issue: 498, expires: "2026-12-31" }, // W1.6 Session expired
  F2Ofg0: { issue: 493, expires: "2026-12-31" }, // W2.1 Connect Gmail
  nKD1b: { issue: 493, expires: "2026-12-31" }, // W2.2 Scanning
  eXcUw: { issue: 493, expires: "2026-12-31" }, // W2.3 Inbox
  PSHPF: { issue: 493, expires: "2026-12-31" }, // W2.4 Recruiter reply
  FUipv: { issue: 498, expires: "2026-12-31" }, // W3.1 New chat
  ISnTZ: { issue: 498, expires: "2026-12-31" }, // W3.2 Chat history
  lOO77: { issue: 498, expires: "2026-12-31" }, // W3.3 More ideas
  kfJuz: { issue: 498, expires: "2026-12-31" }, // W3.4 Composer menus
  Vm0eJ: { issue: 498, expires: "2026-12-31" }, // W3.5 Coach working
  wiQ9M: { issue: 498, expires: "2026-12-31" }, // W3.6 Free cap reached
  kmUTI: { issue: 498, expires: "2026-12-31" }, // W3.7 Coach panel
  NHq3j: { issue: 498, expires: "2026-12-31" }, // W4.1 Jobs coming soon
  YC0lV: { issue: 498, expires: "2026-12-31" }, // W5.1 Paper first run
  mkEKx: { issue: 498, expires: "2026-12-31" }, // W5.2 Paper library
  VH2fp: { issue: 498, expires: "2026-12-31" }, // W5.3 Paper menus
  O7zOJK: { issue: 498, expires: "2026-12-31" }, // W5.4 No results
  YCAbn: { issue: 498, expires: "2026-12-31" }, // W5.5 Delete confirm
  aZiLz: { issue: 498, expires: "2026-12-31" }, // W6.1 Start: blank or template
  L3V6y: { issue: 498, expires: "2026-12-31" }, // W6.2 Blank doc
  pCOLZ: { issue: 498, expires: "2026-12-31" }, // W6.3 Slash menu
  TtBmY: { issue: 498, expires: "2026-12-31" }, // W6.4 Editing
  F0BP4A: { issue: 498, expires: "2026-12-31" }, // W6.5 Block menu
  mOKD3: { issue: 498, expires: "2026-12-31" }, // W6.6 Drag a block
  jcbPS: { issue: 498, expires: "2026-12-31" }, // W6.7 CV done
  DPAVo: { issue: 498, expires: "2026-12-31" }, // W6.8 Importing a file
  Uh2Ku: { issue: 498, expires: "2026-12-31" }, // W6.9 Check import
  gWPIB: { issue: 498, expires: "2026-12-31" }, // W6.10 Can't read file
  k8HycK: { issue: 498, expires: "2026-12-31" }, // W6.11 Over one page
  NgYML: { issue: 498, expires: "2026-12-31" }, // W7.1 Start: pick the job
  tsfNR: { issue: 498, expires: "2026-12-31" }, // W7.2 Drafting
  sgAtL: { issue: 498, expires: "2026-12-31" }, // W7.3 Letter + suggestion
  D1s74Z: { issue: 498, expires: "2026-12-31" }, // W7.4 Can't read job link
  FCDYX: { issue: 498, expires: "2026-12-31" }, // W8.1 Proof coming soon
  D8PoQ6: { issue: 498, expires: "2026-12-31" }, // W9.1 Board empty
  c4KwjR: { issue: 498, expires: "2026-12-31" }, // W9.2 New job
  aLOFO: { issue: 498, expires: "2026-12-31" }, // W9.3 Board
  f0rS0: { issue: 498, expires: "2026-12-31" }, // W9.4 List
  NsAiG: { issue: 498, expires: "2026-12-31" }, // W9.5 Filters no results
  a3PFL: { issue: 498, expires: "2026-12-31" }, // W9.6 Drag to stage
  U4613: { issue: 498, expires: "2026-12-31" }, // W9.7 Calendar month
  ZA60d: { issue: 498, expires: "2026-12-31" }, // W9.8 Calendar week
  Z3OFW: { issue: 498, expires: "2026-12-31" }, // W10.1 Filled in
  tNZ73: { issue: 498, expires: "2026-12-31" }, // W10.2 Company missing
  pD2lq: { issue: 498, expires: "2026-12-31" }, // W10.3 Already on your board
  qSuLB: { issue: 498, expires: "2026-12-31" }, // W10.4 Job detail
  MWsZM: { issue: 498, expires: "2026-12-31" }, // W10.5 Link from Paper
  Wlp2X: { issue: 498, expires: "2026-12-31" }, // W10.6 Closed job
  jHl7W: { issue: 498, expires: "2026-12-31" }, // W10.7 Delete job
  RAl5t: { issue: 498, expires: "2026-12-31" }, // W11.1 Pitch coming soon
  qCgR7: { issue: 498, expires: "2026-12-31" }, // W12.1 Preferences
  LiQPl: { issue: 498, expires: "2026-12-31" }, // W12.2 Coach
  K5FuN: { issue: 498, expires: "2026-12-31" }, // W12.3 Integrations
  U6XwWT: { issue: 498, expires: "2026-12-31" }, // W12.4 Usage & limits
  vOOtp: { issue: 498, expires: "2026-12-31" }, // W12.5 Billing
  dgd0V: { issue: 498, expires: "2026-12-31" }, // W12.6 Account
  LG57z: { issue: 498, expires: "2026-12-31" }, // W12.7 Delete account
}

const TODAY = new Date().toISOString().slice(0, 10)
const srcDir = fileURLToPath(new URL("..", import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full)
    return [full]
  })
}

const all = files(srcDir)
const snapshots = all.filter((file) =>
  /\.snapshot\.(json|ts)$/.test(path.basename(file))
)
const tests = all
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => readFileSync(file, "utf8"))

function frameIdOf(file: string): string | null {
  const match = /"?frameId"?\s*:\s*"([^"]+)"/.exec(readFileSync(file, "utf8"))
  return match?.[1] ?? null
}

function readByTest(file: string): boolean {
  const stem = path.basename(file).replace(/\.(json|ts)$/, "")
  return tests.some((source) =>
    new RegExp(
      `["'][^"']*/${stem.replaceAll(".", "\\.")}(\\.json|\\.ts)?["']`
    ).test(source)
  )
}

const covered = new Map<string, string>()
for (const file of snapshots) {
  const id = frameIdOf(file)
  if (id && readByTest(file)) covered.set(id, path.relative(srcDir, file))
}

describe("design frame coverage", () => {
  it("every release frame has a parity snapshot a test reads, or a pending entry", () => {
    const problems = manifest.frames
      .filter((frame) => !covered.has(frame.id) && !PENDING_FRAMES[frame.id])
      .map(
        (frame) =>
          `${frame.name} (${frame.id}) has no parity snapshot. Run node scripts/pen-snapshot.mjs <opencv.pen> ${frame.id} apps/web/src/features/<surface>/design/<name>.snapshot.json and read it from a test that compares the screen to the frame, like features/auth/auth-design-parity.test.tsx.`
      )
    expect(problems).toEqual([])
  })

  it("pending entries are still needed, known and not expired", () => {
    const ids = new Set(manifest.frames.map((frame) => frame.id))
    const problems = Object.entries(PENDING_FRAMES).flatMap(([id, entry]) => {
      if (!ids.has(id))
        return [
          `${id} is not a release frame in design-frames.json. Remove it from PENDING_FRAMES.`,
        ]
      if (covered.has(id))
        return [
          `${id} is covered by ${covered.get(id)}. Remove it from PENDING_FRAMES.`,
        ]
      if (entry.expires < TODAY)
        return [
          `${id} expired on ${entry.expires}. Build it from the pen (#${entry.issue}), or get the operator to extend it.`,
        ]
      return []
    })
    expect(problems).toEqual([])
  })
})
