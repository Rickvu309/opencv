import { describe, expect, it } from "vitest"

import {
  coalescedWrite,
  JournalRefusal,
  nextCommand,
  openDraft,
  openJournal,
  typeInto,
} from "./paper-package-journal.ts"

function code(run: () => unknown) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(JournalRefusal)
    return (error as JournalRefusal).code
  }
  throw new Error("expected a refusal")
}

describe("draft journal", () => {
  it("carries one command id and the newest generation", () => {
    const opened = openJournal("cmd-1", "Hi")
    const once = typeInto(opened, "Hi there")
    const twice = typeInto(once, "Hi there now")
    const write = coalescedWrite(twice)
    expect(write).toEqual({
      commandId: "cmd-1",
      generation: 3,
      words: "Hi there now",
    })
    expect(once.commandId).toBe("cmd-1")
    expect(opened.words).toBe("Hi")
    expect(Object.isFrozen(write)).toBe(true)
  })

  it("opens an unsaved draft from the first words", () => {
    expect(openDraft("cmd-1", "Hi")).toEqual({
      commandId: "cmd-1",
      generation: 1,
      words: "Hi",
      saved: false,
    })
  })

  it("keeps the generation when the words do not change", () => {
    const opened = openJournal("cmd-1", "Hi")
    expect(typeInto(opened, "Hi")).toBe(opened)
  })

  it("starts a new command without replacing the words", () => {
    const journal = typeInto(openJournal("cmd-1", "Hi"), "Hi there")
    const next = nextCommand(journal, "cmd-2")
    expect(coalescedWrite(next)).toEqual({
      commandId: "cmd-2",
      generation: 2,
      words: "Hi there",
    })
    expect(journal.commandId).toBe("cmd-1")
  })

  it("refuses an empty command or a repeated command", () => {
    expect(code(() => openJournal("  ", "Hi"))).toBe("empty-command")
    expect(code(() => openJournal("", "Hi"))).toBe("empty-command")
    const journal = openJournal("cmd-1", "Hi")
    expect(code(() => nextCommand(journal, "cmd-1"))).toBe("same-command")
  })
})
