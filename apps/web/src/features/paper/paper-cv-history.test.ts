import { describe, expect, it } from "vitest"

import { defaultCvData } from "./paper-cv-types.ts"
import {
  absorbCvServerSnapshot,
  canRedoCv,
  canUndoCv,
  createCvHistory,
  firstChangedPath,
  isPaperRedoShortcut,
  isPaperUndoShortcut,
  pushCvChange,
  redoCv,
  shouldIgnoreCvHistoryShortcut,
  undoCv,
} from "./paper-cv-history.ts"

const sample = defaultCvData()

function patchSummary(data: typeof sample, summary: string) {
  return { ...data, summary }
}

function patchRole(data: typeof sample, role: string) {
  return {
    ...data,
    experience: data.experience.map((item, i) =>
      i === 0 ? { ...item, role } : item
    ),
  }
}

function patchBullet(data: typeof sample, bullet: string) {
  return {
    ...data,
    experience: data.experience.map((item, i) =>
      i === 0
        ? { ...item, bullets: item.bullets.map((b, bi) => (bi === 0 ? bullet : b)) }
        : item
    ),
  }
}

describe("cv history stack (QVE-210)", () => {
  it("names the first changed path for summary, role, and bullet", () => {
    expect(firstChangedPath(sample, patchSummary(sample, "Café"))).toBe(
      "summary"
    )
    expect(firstChangedPath(sample, patchRole(sample, "Café lead"))).toBe(
      "experience.0.role"
    )
    expect(
      firstChangedPath(sample, patchBullet(sample, "Shipped the café board"))
    ).toBe("experience.0.bullets.0")
  })

  it("undoes a summary patch back to the prior snapshot", () => {
    const start = createCvHistory(sample)
    const edited = pushCvChange(
      start,
      patchSummary(sample, "Café rewrite"),
      1_000
    )
    expect(canUndoCv(edited)).toBe(true)
    const undone = undoCv(edited)
    expect(undone?.present.summary).toBe(sample.summary)
    expect(undone?.present.summary).not.toBe("Café rewrite")
    expect(canRedoCv(undone!)).toBe(true)
  })

  it("coalesces keystrokes in one field, then splits on another field", () => {
    const t0 = 10_000
    let history = createCvHistory(sample)
    history = pushCvChange(history, patchSummary(sample, "Caf"), t0)
    history = pushCvChange(history, patchSummary(sample, "Café"), t0 + 80)
    history = pushCvChange(
      history,
      patchSummary(sample, "Café rewrite"),
      t0 + 160
    )
    expect(history.past).toHaveLength(1)
    expect(history.present.summary).toBe("Café rewrite")

    history = pushCvChange(history, patchRole(history.present, "Barista"), t0 + 200)
    expect(history.past).toHaveLength(2)
    expect(history.present.experience[0]?.role).toBe("Barista")

    const afterRole = undoCv(history)
    expect(afterRole?.present.experience[0]?.role).toBe(sample.experience[0]?.role)
    expect(afterRole?.present.summary).toBe("Café rewrite")

    const afterSummary = undoCv(afterRole!)
    expect(afterSummary?.present.summary).toBe(sample.summary)
    expect(afterSummary?.present.experience[0]?.role).toBe(
      sample.experience[0]?.role
    )
  })

  it("redoes the undone change and drops redo after a new edit", () => {
    let history = pushCvChange(
      createCvHistory(sample),
      patchBullet(sample, "One café outcome"),
      1_000
    )
    history = undoCv(history)!
    history = redoCv(history)!
    expect(history.present.experience[0]?.bullets[0]).toBe("One café outcome")
    expect(canRedoCv(history)).toBe(false)

    history = undoCv(history)!
    history = pushCvChange(
      history,
      patchBullet(history.present, "Different outcome"),
      2_000
    )
    expect(history.future).toHaveLength(0)
    expect(history.present.experience[0]?.bullets[0]).toBe("Different outcome")
  })

  it("keeps the stack after an autosave echo of the same snapshot", () => {
    const edited = pushCvChange(
      createCvHistory(sample),
      patchSummary(sample, "Saved café summary"),
      1_000
    )
    const echoed = absorbCvServerSnapshot(edited, edited.present)
    expect(echoed).toBe(edited)
    expect(canUndoCv(echoed)).toBe(true)
    expect(undoCv(echoed)?.present.summary).toBe(sample.summary)
  })

  it("resets when a server snapshot actually differs", () => {
    const edited = pushCvChange(
      createCvHistory(sample),
      patchSummary(sample, "Local café edit"),
      1_000
    )
    const incoming = patchSummary(sample, "Coach version")
    const absorbed = absorbCvServerSnapshot(edited, incoming)
    expect(canUndoCv(absorbed)).toBe(false)
    expect(absorbed.present.summary).toBe("Coach version")
  })

  it("no-ops undo and redo at the ends of the stack", () => {
    const start = createCvHistory(sample)
    expect(undoCv(start)).toBeNull()
    expect(redoCv(start)).toBeNull()
  })
})

describe("cv history shortcuts (QVE-210)", () => {
  it("matches toolbar-equivalent undo and redo chords", () => {
    expect(
      isPaperUndoShortcut({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      })
    ).toBe(true)
    expect(
      isPaperUndoShortcut({
        key: "z",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
      })
    ).toBe(true)
    expect(
      isPaperRedoShortcut({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
      })
    ).toBe(true)
    expect(
      isPaperRedoShortcut({
        key: "y",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
      })
    ).toBe(true)
    expect(
      isPaperUndoShortcut({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
      })
    ).toBe(false)
  })

  it("leaves Coach dialog and the title field alone", () => {
    const dialog = document.createElement("div")
    dialog.setAttribute("role", "dialog")
    const composer = document.createElement("textarea")
    dialog.append(composer)
    document.body.append(dialog)
    expect(shouldIgnoreCvHistoryShortcut(composer)).toBe(true)

    const title = document.createElement("input")
    document.body.append(title)
    expect(shouldIgnoreCvHistoryShortcut(title)).toBe(true)

    const field = document.createElement("span")
    field.setAttribute("data-paper-canvas-field", "")
    const canvas = document.createElement("div")
    canvas.setAttribute("data-paper-canvas", "")
    canvas.append(field)
    document.body.append(canvas)
    expect(shouldIgnoreCvHistoryShortcut(field)).toBe(false)

    dialog.remove()
    title.remove()
    canvas.remove()
  })
})
