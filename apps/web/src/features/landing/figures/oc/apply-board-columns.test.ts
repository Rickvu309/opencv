// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { COLUMN_GAP, COLUMN_WIDTH } from "./apply-board-columns.ts"

const css = readFileSync(new URL("./apply-board.css", import.meta.url), "utf8")

describe("apply board figure", () => {
  it("the drag translate in apply-board.css equals one column pitch (width plus gap)", () => {
    const drag = css.match(/@keyframes oc-drag \{[\s\S]*?\n\}\n/)
    expect(drag).not.toBeNull()
    const pitches = [...drag![0].matchAll(/translate\((\d+)px/g)].map((m) =>
      Number(m[1])
    )
    expect(pitches.length).toBeGreaterThan(0)
    for (const pitch of pitches) expect(pitch).toBe(COLUMN_WIDTH + COLUMN_GAP)
  })
})
