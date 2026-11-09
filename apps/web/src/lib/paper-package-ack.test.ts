import { describe, expect, it } from "vitest"

import {
  AckRefusal,
  applyReply,
  draftFromWrite,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "./paper-package-ack.ts"
import { nextCommand, openJournal, typeInto } from "./paper-package-journal.ts"

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

function code(run: () => unknown) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(AckRefusal)
    return (error as AckRefusal).code
  }
  throw new Error("expected a refusal")
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
    expect(
      applyReply(current, stored(3, "Hi"), receipt(3, words))
    ).toMatchObject({ words, saved: false })
    expect(applyReply(current, stored(2, words), receipt(3, words)).saved).toBe(
      false
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
    const saved = applyReply(current, stored(3, words), receipt(3, words))
    expect(
      applyReply(saved, stored(3, words), {
        kind: "refusal",
        commandId: "cmd-1",
        generation: 3,
      })
    ).toMatchObject({ words, saved: false })
    expect(
      applyReply(current, stored(1, "Hi"), {
        kind: "refusal",
        commandId: "cmd-1",
        generation: 1,
      })
    ).toBe(current)
  })

  it("keeps Saved when a late reply names an abandoned command", () => {
    const saved = applyReply(draft(), stored(3, words), receipt(3, words))
    const moved = nextCommand(saved, "cmd-2")
    const retried = applyReply(
      draftFromWrite(moved),
      stored(moved.generation, moved.words),
      receipt(moved.generation, moved.words, moved.commandId)
    )
    expect(retried).toEqual({
      commandId: "cmd-2",
      generation: 3,
      words,
      saved: true,
    })
    expect(
      applyReply(retried, stored(3, words), receipt(3, words, "cmd-1"))
    ).toBe(retried)
    expect(
      applyReply(retried, stored(3, words), {
        kind: "refusal",
        commandId: "cmd-1",
        generation: 3,
      })
    ).toBe(retried)
  })

  it("refuses a receipt that has no body", () => {
    expect(
      code(() =>
        applyReply(draft(), stored(3, words), {
          kind: "receipt",
        } as Acknowledgement)
      )
    ).toBe("empty-reply")
  })
})
