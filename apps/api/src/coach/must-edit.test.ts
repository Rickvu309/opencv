import {
  PAPER_CONTENT_VERSION,
  emptyCvDocument,
  starterCvDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  applyRewriteToFocusContent,
  describeExperienceRoles,
  describeFocusDoc,
  findFocusRewriteOriginal,
  isPaperEditAsk,
  latestUserText,
  localRewriteText,
  mustEditMissCopy,
  mustEditPrepareStep,
  mustEditStillNeedsUpdate,
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
    expect(
      isPaperEditAsk(
        "Rewrite the Experience checkout bullet for a product internship",
        true
      )
    ).toBe(true)
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

describe("mustEditPrepareStep", () => {
  const rewrite =
    "Rewrite the Experience checkout bullet for a product internship"

  it("hides read tools on a focus-doc rewrite so Free cannot stop at paper_getDoc", () => {
    expect(
      mustEditPrepareStep({
        userText: rewrite,
        hasFocusDoc: true,
        calledTools: [],
      })
    ).toEqual({
      toolChoice: { type: "tool", toolName: "paper_updateContent" },
      activeTools: ["paper_updateContent"],
    })
    expect(
      mustEditPrepareStep({
        userText: rewrite,
        hasFocusDoc: true,
        calledTools: ["paper_getDoc"],
      })
    ).toEqual({
      toolChoice: { type: "tool", toolName: "paper_updateContent" },
      activeTools: ["paper_updateContent"],
    })
  })

  it("does not force a mutation on QVE-188 advice asks", () => {
    for (const userText of [
      "How do I edit my summary?",
      "Can you fix my interview nerves?",
    ]) {
      expect(
        mustEditPrepareStep({
          userText,
          hasFocusDoc: true,
          calledTools: [],
        })
      ).toEqual({})
      expect(
        mustEditStillNeedsUpdate({
          userText,
          hasFocusDoc: true,
          calledTools: ["paper_getDoc"],
        })
      ).toBe(false)
    }
  })

  it("still needs an update after a read-only rewrite turn", () => {
    expect(
      mustEditStillNeedsUpdate({
        userText: rewrite,
        hasFocusDoc: true,
        calledTools: ["paper_getDoc"],
      })
    ).toBe(true)
    expect(
      mustEditStillNeedsUpdate({
        userText: rewrite,
        hasFocusDoc: true,
        calledTools: ["paper_updateContent"],
      })
    ).toBe(false)
  })
})

describe("mustEditTurnInstruction", () => {
  it("bans paste-yourself and ask-to-apply", () => {
    const focus = mustEditTurnInstruction(true)
    const named = mustEditTurnInstruction(false)
    expect(focus).toMatch(/paper_updateContent/)
    expect(focus).toMatch(/Do not call paper_getDoc/)
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
    expect(described).toMatch(/Do not call paper_getDoc/)
    expect(described).not.toMatch(/!/)
  })
})

describe("focus-doc rewrite targeting", () => {
  const doc = toCoachFocusDoc({
    id: "11111111-1111-7111-8111-111111111111",
    name: "Sample internship CV",
    contentKind: "cv",
    status: "draft",
    content: starterCvDocument(),
    contentVersion: PAPER_CONTENT_VERSION,
  })
  const ask =
    "Rewrite the Experience checkout bullet for a product internship"

  it("still targets Summary when the ask names Summary", () => {
    expect(findFocusRewriteOriginal(doc, "Rewrite my summary")).toBe(
      starterCvDocument().summary
    )
  })

  it("finds the checkout Experience bullet and applies a rewrite", () => {
    const original = findFocusRewriteOriginal(doc, ask)
    expect(original).toBe(starterCvDocument().experience[1]?.bullets[0])

    const next = localRewriteText(original ?? "", ask)
    expect(next).not.toBe(original)
    expect(next).toMatch(/product internship/i)
    expect(next).not.toMatch(/!/)

    const content = applyRewriteToFocusContent(doc, ask, next)
    expect(content).toBeTruthy()
    const bullets =
      content &&
      typeof content === "object" &&
      "experience" in content
        ? (
            content as {
              experience: { bullets: string[] }[]
            }
          ).experience[1]?.bullets
        : undefined
    expect(bullets?.[0]).toBe(next)
    expect(bullets?.[0]).not.toBe(starterCvDocument().experience[1]?.bullets[0])
  })

  it("does not invent a rewrite plan for advice asks", () => {
    expect(isPaperEditAsk("How do I edit my summary?", true)).toBe(false)
    expect(
      isPaperEditAsk("Can you fix my interview nerves?", true)
    ).toBe(false)
  })

  it("does not target Summary when Experience is named but no bullet scores", () => {
    const starterSummary = starterCvDocument().summary
    for (const userText of [
      "Rewrite the Experience section",
      "Rewrite the Experience section to be more executive",
      "Rewrite this bullet to be more executive",
    ]) {
      expect(isPaperEditAsk(userText, true)).toBe(true)
      expect(findFocusRewriteOriginal(doc, userText)).toBeNull()
      expect(
        applyRewriteToFocusContent(doc, userText, "Should not land")
      ).toBeNull()
    }

    const ticketExampleDoc = toCoachFocusDoc({
      id: "11111111-1111-7111-8111-111111111111",
      name: "Sample internship CV",
      contentKind: "cv",
      status: "draft",
      content: {
        ...starterCvDocument(),
        experience: [
          {
            role: "Product discovery lead",
            company: "Campus product club",
            period: "2024 – Present",
            location: "Volunteer",
            bullets: ["Ran weekly problem interviews with 8 classmates."],
          },
        ],
      },
      contentVersion: PAPER_CONTENT_VERSION,
    })
    expect(
      findFocusRewriteOriginal(
        ticketExampleDoc,
        "Rewrite the Experience section to be clearer"
      )
    ).toBeNull()
    expect(
      applyRewriteToFocusContent(
        ticketExampleDoc,
        "Rewrite the Experience section to be clearer",
        "Should not land"
      )
    ).toBeNull()

    const miss = mustEditMissCopy(doc, "Rewrite the Experience section")
    expect(miss.receipt).toBe("Could not match a bullet in Experience.")
    expect(miss.nextStep).toMatch(/Product discovery lead/)
    expect(miss.nextStep).toMatch(/Checkout UX/)
    expect(miss.nextStep).not.toMatch(/!/)
    expect(miss.nextStep).not.toMatch(new RegExp(starterSummary.slice(0, 24)))
    expect(describeExperienceRoles(doc)).toEqual([
      "Product discovery lead · Campus product club · Volunteer",
      "Side project · Checkout UX · Personal · Remote",
    ])
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
