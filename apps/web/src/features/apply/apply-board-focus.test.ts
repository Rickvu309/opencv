import { describe, expect, it } from "vitest"

import { stepFocus } from "./apply-board-focus.ts"

const board = [["a1", "a2", "a3"], [], ["c1"], ["d1", "d2"]]

describe("board focus", () => {
  it("starts on the first card of the first column with cards", () => {
    expect(stepFocus([[], ["b1"]], null, "ArrowDown")).toBe("b1")
    expect(stepFocus(board, "gone", "ArrowRight")).toBe("a1")
  })

  it("moves within a column and stops at its ends", () => {
    expect(stepFocus(board, "a1", "ArrowDown")).toBe("a2")
    expect(stepFocus(board, "a3", "ArrowDown")).toBe("a3")
    expect(stepFocus(board, "a1", "ArrowUp")).toBe("a1")
  })

  it("skips empty columns and keeps the row when it can", () => {
    expect(stepFocus(board, "a3", "ArrowRight")).toBe("c1")
    expect(stepFocus(board, "c1", "ArrowRight")).toBe("d1")
    expect(stepFocus(board, "d2", "ArrowLeft")).toBe("c1")
    expect(stepFocus(board, "d2", "ArrowRight")).toBe("d2")
  })

  it("returns nothing on an empty board", () => {
    expect(stepFocus([[], []], null, "ArrowDown")).toBeNull()
  })
})
