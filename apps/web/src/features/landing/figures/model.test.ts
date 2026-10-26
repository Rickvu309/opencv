import { describe, expect, it } from "vitest"

import { PART_COUNT as DISPATCH_PARTS } from "./dispatch/geometry.ts"
import {
  DISPATCH_SPEC,
  DISPATCH_STAGES,
  PLOTTER_SPEC,
  PROOF_SPEC,
  DEMONSTRATION_SECONDS,
  applyKey,
  asStage,
  demonstrationValue,
  dispatchPose,
  dispatchReadout,
  plotterPose,
  plotterReadout,
  previousStage,
  proofPose,
  proofReadout,
} from "./model.ts"
import { PART_COUNT as PLOTTER_PARTS } from "./plotter/geometry.ts"
import { PART_COUNT as PROOF_PARTS } from "./proof/geometry.ts"

describe("figure part counts", () => {
  it("keeps each instrument between 40 and 80 named parts", () => {
    expect(PROOF_PARTS).toBe(63)
    expect(PLOTTER_PARTS).toBe(59)
    expect(DISPATCH_PARTS).toBe(57)
    for (const count of [PROOF_PARTS, PLOTTER_PARTS, DISPATCH_PARTS]) {
      expect(count).toBeGreaterThanOrEqual(40)
      expect(count).toBeLessThanOrEqual(80)
    }
  })
})

describe("proof press", () => {
  it("holds the stamp until context, action, and outcome are seated", () => {
    expect(proofPose(0)).toMatchObject({
      links: { context: 0, action: 0, outcome: 0 },
      platen: 0,
      readout: "held, context open",
    })
    expect(proofPose(1).links).toEqual({ context: 1, action: 0, outcome: 0 })
    expect(proofPose(1).readout).toBe("held, action open")
    expect(proofPose(2).platen).toBe(0)
    expect(proofReadout(proofPose(2).links)).toBe("held, outcome open")

    const seating = proofPose(2.5)
    expect(seating.platen).toBeCloseTo(0.5)
    expect(seating.links.outcome).toBeCloseTo(0.5)
    expect(seating.readout).toBe("held, outcome open")

    const stamped = proofPose(3)
    expect(stamped.platen).toBe(1)
    expect(stamped.readout).toBe("stamped, context, action, outcome")
  })
})

describe("cv plotter", () => {
  it("copies the line onto the letter and does not send it", () => {
    expect(plotterReadout(2)).toMatch(/Letter/)
    expect(plotterReadout(2)).not.toMatch(/send|mail/i)
    expect(plotterPose(0).z).toBe(0)
    expect(plotterPose(0.5).z).toBeGreaterThan(0)
    expect(plotterPose(0).sheet).toBe(0)
    expect(plotterPose(1).sheet).toBe(0)
    expect(plotterPose(1.49).sheet).toBe(0)
    expect(plotterPose(1.5).sheet).toBe(1)
    expect(plotterPose(2).sheet).toBe(1)
    expect(plotterPose(2).readout).toBe("Letter, that line")
  })
})

describe("dispatch rack", () => {
  it("keeps the card on the board and treats sent as a mark", () => {
    expect(DISPATCH_STAGES).toEqual(["Inbox", "Prep", "Sent", "Live", "Closed"])
    expect(dispatchReadout(2)).toContain("not mailed")
    expect(dispatchReadout(0)).toBe("Inbox, on your board")
    expect(previousStage(0)).toBeNull()
    expect(previousStage(1)).toBe(0)
    expect(asStage(0.2)).toBe(0)
    expect(dispatchPose(0.5).readout).toBe("moving, still on the board")
    expect(dispatchPose(0).x).toBe(0)
    expect(dispatchPose(4).x).toBeGreaterThan(0)
  })
})

describe("figure demonstration", () => {
  it("sweeps to the far stop and back to the start within five seconds", () => {
    expect(DEMONSTRATION_SECONDS).toBeLessThanOrEqual(5)
    expect(demonstrationValue(0, 4, 0)).toBe(0)
    expect(demonstrationValue(0, 4, 2.5)).toBe(4)
    expect(demonstrationValue(0, 4, 5)).toBe(0)
    expect(demonstrationValue(0, 4, 9)).toBe(0)
    expect(demonstrationValue(0, 3, 1.25)).toBeCloseTo(1.5)
    expect(demonstrationValue(0, 3, 3.75)).toBeCloseTo(1.5)
    for (const spec of [PROOF_SPEC, PLOTTER_SPEC, DISPATCH_SPEC]) {
      for (let clock = 0; clock <= DEMONSTRATION_SECONDS; clock += 0.25) {
        const value = demonstrationValue(spec.min, spec.max, clock)
        expect(value).toBeGreaterThanOrEqual(spec.min)
        expect(value).toBeLessThanOrEqual(spec.max)
      }
      expect(
        demonstrationValue(spec.min, spec.max, DEMONSTRATION_SECONDS)
      ).toBe(spec.min)
    }
  })
})

describe("figure keys", () => {
  it("steps, clamps, and uses a double step only when the range is wider than two", () => {
    expect(applyKey(PROOF_SPEC.max, "ArrowRight", PROOF_SPEC, false)).toBe(
      PROOF_SPEC.max
    )
    expect(applyKey(PROOF_SPEC.min, "ArrowLeft", PROOF_SPEC, false)).toBe(
      PROOF_SPEC.min
    )
    expect(applyKey(2, "Home", PROOF_SPEC, false)).toBe(PROOF_SPEC.min)
    expect(applyKey(2, "Escape", DISPATCH_SPEC, false)).toBe(DISPATCH_SPEC.min)
    expect(applyKey(0, "End", PLOTTER_SPEC, false)).toBe(PLOTTER_SPEC.max)
    expect(applyKey(0, "ArrowRight", PROOF_SPEC, true)).toBe(2)
    expect(applyKey(0, "ArrowRight", PLOTTER_SPEC, true)).toBe(1)
    expect(applyKey(0, "ArrowRight", DISPATCH_SPEC, true)).toBe(2)
    expect(applyKey(3, "ArrowUp", DISPATCH_SPEC, true)).toBe(4)
    expect(applyKey(1, "Enter", PROOF_SPEC, false)).toBeNull()
  })
})
