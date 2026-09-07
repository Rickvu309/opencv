import {
  PAPER_CONTENT_VERSION,
  emptyCvDocument,
  starterCvDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  describeFocusDoc,
  isPaperEditAsk,
  latestUserText,
  mustEditToolChoice,
  mustEditTurnInstruction,
  toolNamesFromSteps,
  toCoachFocusDoc,
} from "./must-edit.js"

describe("isPaperEditAsk", () => {
  it("treats rewrite/edit asks on the open doc as must-edit", () => {
    expect(isPaperEditAsk("Rewrite this Experience bullet", true)).toBe(true)
    expect(
      isPaperEditAsk("Sharpen my checkout project bullet", true)
    ).toBe(true)
    expect(isPaperEditAsk("Make my summary one sentence", true)).toBe(true)
    expect(isPaperEditAsk("Tailor for associate PM intern", true)).toBe(true)
    expect(isPaperEditAsk("Fix spelling", true)).toBe(true)
    expect(isPaperEditAsk("Fix spelling on the doc", true)).toBe(true)
    expect(isPaperEditAsk("Make it shorter", true)).toBe(true)
    expect(isPaperEditAsk("Edit my summary", true)).toBe(true)
    expect(isPaperEditAsk("Can you rewrite my summary?", true)).toBe(true)
    expect(isPaperEditAsk("Can you edit my summary?", true)).toBe(true)
    expect(isPaperEditAsk("Can you fix this?", true)).toBe(true)
  })

  it("requires a Paper noun when there is no focus doc", () => {
    expect(isPaperEditAsk("Shorten my Cover: Associate PM intern letter")).toBe(
      true
    )
    expect(isPaperEditAsk("Rewrite my interview answers")).toBe(false)
    expect(isPaperEditAsk("Make my interview answers stronger")).toBe(false)
  })

  it("leaves advice-only Home turns alone", () => {
    expect(isPaperEditAsk("What should I cut?")).toBe(false)
    expect(isPaperEditAsk("What should I cut?", true)).toBe(false)
    expect(isPaperEditAsk("How do I prepare for interviews?")).toBe(false)
    expect(isPaperEditAsk("Move my starred card to Prep")).toBe(false)
  })

  it("does not treat edit/fix advice as a Paper edit ask when a focus doc is open", () => {
    expect(isPaperEditAsk("How do I edit my summary?", true)).toBe(false)
    expect(isPaperEditAsk("What should I edit?", true)).toBe(false)
    expect(isPaperEditAsk("Should I edit the Experience section?", true)).toBe(
      false
    )
    expect(isPaperEditAsk("Can you fix my interview nerves?", true)).toBe(false)
    expect(isPaperEditAsk("How do I rewrite my summary?", true)).toBe(false)
  })
})

describe("mustEditToolChoice", () => {
  it("forces paper_updateContent on a focus-doc edit ask", () => {
    expect(
      mustEditToolChoice({
        userText: "Rewrite the checkout bullet",
        hasFocusDoc: true,
        calledTools: [],
      })
    ).toEqual({ type: "tool", toolName: "paper_updateContent" })
  })

  it("stops forcing after paper_updateContent has been attempted", () => {
    expect(
      mustEditToolChoice({
        userText: "Rewrite the checkout bullet",
        hasFocusDoc: true,
        calledTools: ["paper_updateContent"],
      })
    ).toBeUndefined()
  })

  it("walks list → get → update when the User names a doc", () => {
    const named = {
      userText: "Shorten my Cover: Associate PM intern letter",
      hasFocusDoc: false,
    }
    expect(mustEditToolChoice({ ...named, calledTools: [] })).toEqual({
      type: "tool",
      toolName: "paper_listDocs",
    })
    expect(
      mustEditToolChoice({ ...named, calledTools: ["paper_listDocs"] })
    ).toEqual({ type: "tool", toolName: "paper_getDoc" })
    expect(
      mustEditToolChoice({
        ...named,
        calledTools: ["paper_listDocs", "paper_getDoc"],
      })
    ).toEqual({ type: "tool", toolName: "paper_updateContent" })
  })

  it("does not force tools on a Home advice turn", () => {
    expect(
      mustEditToolChoice({
        userText: "How do I prepare for interviews?",
        hasFocusDoc: false,
        calledTools: [],
      })
    ).toBeUndefined()
  })

  it("does not force paper_updateContent on focus-doc advice that mentions edit/fix", () => {
    for (const userText of [
      "How do I edit my summary?",
      "What should I edit?",
      "Should I edit the Experience section?",
      "Can you fix my interview nerves?",
    ]) {
      expect(
        mustEditToolChoice({
          userText,
          hasFocusDoc: true,
          calledTools: [],
        })
      ).toBeUndefined()
    }
  })
})

describe("mustEditTurnInstruction", () => {
  it("bans paste-yourself and ask-to-apply", () => {
    const focus = mustEditTurnInstruction(true)
    const named = mustEditTurnInstruction(false)
    expect(focus).toMatch(/paper_updateContent/)
    expect(focus).toMatch(/never ask whether to apply/i)
    expect(focus).toMatch(/never tell the User to paste/i)
    expect(focus).not.toMatch(/!/)
    expect(named).toMatch(/paper_listDocs/)
    expect(named).toMatch(/paper_getDoc/)
    expect(named).not.toMatch(/!/)
  })
})

describe("describeFocusDoc", () => {
  it("names sections and includes the current JSON so a rewrite can run without selection", () => {
    const doc = toCoachFocusDoc({
      id: "11111111-1111-7111-8111-111111111111",
      name: "Sample internship CV",
      contentKind: "cv",
      status: "draft",
      content: starterCvDocument(),
      contentVersion: PAPER_CONTENT_VERSION,
    })
    const described = describeFocusDoc(doc)
    expect(described).toContain(doc.id)
    expect(described).toContain(`contentVersion: ${PAPER_CONTENT_VERSION}`)
    expect(described).toMatch(/Experience\[1].*Checkout UX/)
    expect(described).toMatch(/Audited product card density/)
    expect(described).not.toMatch(/café|cafe/i)
    expect(described).toContain(JSON.stringify(doc.content))
    expect(described).toMatch(/never ask whether to apply/)
    expect(described).not.toMatch(/!/)
  })
})

describe("latestUserText / toolNamesFromSteps", () => {
  it("reads the last user message and flattens tool names", () => {
    expect(
      latestUserText([
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Rewrite my summary" },
      ])
    ).toBe("Rewrite my summary")
    expect(
      toolNamesFromSteps([
        { toolCalls: [{ toolName: "paper_getDoc" }] },
        { toolCalls: [{ toolName: "paper_updateContent" }] },
      ])
    ).toEqual(["paper_getDoc", "paper_updateContent"])
  })
})

describe("toCoachFocusDoc", () => {
  it("carries content and version from the owned row", () => {
    const content = emptyCvDocument()
    expect(
      toCoachFocusDoc({
        id: "11111111-1111-7111-8111-111111111111",
        name: "Untitled CV",
        contentKind: "cv",
        status: "draft",
        content,
        contentVersion: 1,
      })
    ).toEqual({
      id: "11111111-1111-7111-8111-111111111111",
      name: "Untitled CV",
      kind: "cv",
      status: "draft",
      content,
      contentVersion: 1,
    })
  })
})
