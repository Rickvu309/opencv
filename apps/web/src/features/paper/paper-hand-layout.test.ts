import { describe, expect, it } from "vitest"

import type { LibraryEntry } from "./paper-library-entries.ts"
import {
  handBand,
  handCardWidth,
  handDrag,
  handList,
  handPose,
  handRelease,
  handCentre,
  handStart,
  handWheel,
} from "./paper-hand-layout.ts"

function paper(name: string, updatedAt: string, index: number): LibraryEntry {
  return {
    type: "paper",
    key: `paper:${index}`,
    word: null,
    doc: {
      id: `id-${index}`,
      name,
      updatedAt,
    },
  } as LibraryEntry
}

describe("paper hand layout", () => {
  it("starts on the newest card until the fan is wider than seven", () => {
    expect(handStart(0)).toBe(0)
    expect(handStart(1)).toBe(0)
    expect(handStart(2)).toBe(0.5)
    expect(handCentre(0.5, 2)).toBe(0)
    expect(handCentre(1.5, 4)).toBe(1)
    expect(
      handPose({
        index: 0,
        pos: 0.5,
        step: 128,
        spread: 3,
        hovered: -1,
        shift: false,
        reduced: false,
      }).z
    ).toBeGreaterThan(
      handPose({
        index: 1,
        pos: 0.5,
        step: 128,
        spread: 3,
        hovered: -1,
        shift: false,
        reduced: false,
      }).z
    )
    expect(handStart(5)).toBe(2)
    expect(handStart(7)).toBe(3)
    expect(handStart(8)).toBe(3)
  })

  it("rubber-bands past the first and last card", () => {
    expect(handBand(-2, 5)).toBe(-0.5)
    expect(handBand(6, 5)).toBe(4.5)
    expect(handBand(2, 5)).toBe(2)
  })

  it("poses a card from its distance to the centre", () => {
    const centre = handPose({
      index: 4,
      pos: 3,
      step: 100,
      spread: 3.6,
      hovered: -1,
      shift: false,
      reduced: false,
    })
    expect(centre).toMatchObject({ x: 100, y: 7, rotate: 7, opacity: 1, z: 45 })
    const left = handPose({
      index: 0,
      pos: 3,
      step: 100,
      spread: 3.6,
      hovered: -1,
      shift: false,
      reduced: false,
    })
    expect(left).toMatchObject({
      x: -300,
      y: 63,
      rotate: -21,
      opacity: 0.5,
      z: 38,
    })
    const far = handPose({
      index: 10,
      pos: 3,
      step: 100,
      spread: 3.6,
      hovered: -1,
      shift: false,
      reduced: false,
    })
    expect(far.hidden).toBe(true)
    expect(far.opacity).toBe(0)
    expect(far.rotate).toBeCloseTo(3.6 * 7)
  })

  it("lifts the hovered card and moves its neighbours aside", () => {
    const lifted = handPose({
      index: 4,
      pos: 3,
      step: 100,
      spread: 3.6,
      hovered: 4,
      shift: false,
      reduced: false,
    })
    expect(lifted.rotate).toBeCloseTo(2.45)
    expect(lifted.y).toBe(-27)
    expect(lifted.scale).toBe(1.04)
    const neighbour = handPose({
      index: 5,
      pos: 4,
      step: 100,
      spread: 3.6,
      hovered: 4,
      shift: false,
      reduced: false,
    })
    expect(neighbour.x).toBe(122)
  })

  it("shifts every card one slot when a file is landing", () => {
    const shifted = handPose({
      index: 4,
      pos: 3,
      step: 100,
      spread: 3.6,
      hovered: -1,
      shift: true,
      reduced: false,
    })
    expect(shifted.x).toBe(200)
  })

  it("rolls by wheel, drag and release", () => {
    expect(handWheel(1, 110, 10)).toBe(2)
    expect(handRelease(1.4, 0, 10)).toBe(1)
    expect(handRelease(1.4, -1, 10)).toBe(4)
    expect(handDrag(2, 100, 100, 10)).toBe(1)
    expect(handDrag(2, -50, 100, 10)).toBe(2.5)
  })

  it("keeps the card width inside the sketch clamp", () => {
    expect(handCardWidth(400)).toBe(150)
    expect(handCardWidth(1200)).toBe(220)
    expect(handCardWidth(800)).toBeCloseTo(176)
  })

  it("orders the visible hand newest first", () => {
    const entries = [
      paper("Older", "2026-01-01T00:00:00.000Z", 0),
      paper("Newer", "2026-02-01T00:00:00.000Z", 1),
    ]
    expect(handList(entries, "all", "").map((entry) => entry.key)).toEqual([
      "paper:1",
      "paper:0",
    ])
    expect(handList(entries, "all", "old")).toHaveLength(1)
    expect(handList(entries, "proofs", "")).toEqual([])
  })
})
