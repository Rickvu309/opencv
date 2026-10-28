import { describe, expect, it } from "vitest"
import snapshot from "./search.snapshot.json"

describe("SearchInput Pen source agreement", () => {
  it("tracks the four source states and maps their shared geometry", () => {
    expect(snapshot.source).toMatchObject({
      componentFrameId: "B4iHj",
      proofFrameId: "K5FuN",
      proofNodeId: "K3c4q",
    })
    for (const state of Object.values(snapshot.states)) {
      expect(state.geometry).toMatchObject({
        height: 36,
        radius: 8,
        padding: [0, 12],
        gap: 8,
      })
      expect(state.icon.name).toBe("search")
      expect(state.icon.width).toBe(15)
      expect(state.text.fontSize).toBe(13)
    }
    expect(snapshot.states.focus.geometry.borderWidth).toBe(1.5)
  })
})
