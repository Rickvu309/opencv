import { describe, expect, it } from "vitest"

import {
  applyReply,
  draftFromWrite,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "./paper-package-ack.ts"
import { openJournal, typeInto } from "./paper-package-journal.ts"

const words = "Hi there now"

function draft(): PackageDraft {
  return draftFromWrite(
    typeInto(typeInto(openJournal("cmd-1", "Hi"), "Hi there"), words)
  )
}

function stored(
  generation: number,
  text: string,
  transaction: LocalObservation["transaction"] = "complete"
): LocalObservation {
  return { generation, words: text, transaction }
}

function receipt(
  generation: number,
  text: string,
  commandId = "cmd-1"
): Acknowledgement {
  return { kind: "receipt", receipt: { commandId, generation, words: text } }
}

describe("draft acknowledgements", () => {
  it("starts unsaved", () => {
    expect(draft()).toEqual({
      commandId: "cmd-1",
      generation: 3,
      words,
      saved: false,
    })
  })

  it("is saved only when local storage finished for those words and the receipt matches", () => {
    const current = draft()
    const saved = applyReply(current, stored(3, words), receipt(3, words))
    expect(saved).toEqual({ ...current, saved: true })
    expect(saved.words).toBe(words)
    expect(
      applyReply(current, stored(3, words, "pending"), receipt(3, words)).saved
    ).toBe(false)
    expect(
      applyReply(current, stored(3, words, "aborted"), receipt(3, words)).saved
    ).toBe(false)
    expect(applyReply(current, null, receipt(3, words)).saved).toBe(false)
    expect(applyReply(current, stored(3, words), receipt(3, "Hi")).saved).toBe(
      false
    )
    expect(applyReply(current, stored(3, "Hi"), receipt(3, words)).words).toBe(
      words
    )
    expect(
      applyReply(current, stored(3, words), receipt(3, words, "cmd-2")).saved
    ).toBe(false)
  })

  it("does not let an older reply replace newer words", () => {
    const current = draft()
    const older = applyReply(current, stored(1, "Hi"), receipt(1, "Hi"))
    expect(older).toBe(current)
    expect(older.words).toBe(words)
    const saved = applyReply(current, stored(3, words), receipt(3, words))
    expect(applyReply(saved, stored(1, "Hi"), receipt(1, "Gone"))).toBe(saved)
  })

  it("leaves the draft in place when the save is refused", () => {
    const current = draft()
    const refused = applyReply(current, stored(3, words), {
      kind: "refusal",
      commandId: "cmd-1",
      generation: 3,
    })
    expect(refused.words).toBe(words)
    expect(refused.saved).toBe(false)
    expect(
      applyReply(current, stored(1, "Hi"), {
        kind: "refusal",
        commandId: "cmd-1",
        generation: 1,
      })
    ).toBe(current)
  })
})
