import {
  COACH_HISTORY_CHAR_BUDGET,
  COACH_HISTORY_MESSAGE_CAP,
  COACH_WORKSPACE_LIST_CAP,
  type ThreadMessage,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  assembleSystemPrompt,
  flattenMessage,
  historyForRegenerate,
  personaSystemPrompt,
  regenerateInstruction,
  summarizeWorkspace,
  windowHistory,
  type WorkspaceSnapshot,
} from "./prompt.js"

function userMessage(text: string, id = "u1"): ThreadMessage {
  return {
    id,
    role: "user",
    text,
    createdAt: "2026-08-25T00:00:00.000Z",
  }
}

function coachMessage(
  text: string,
  parts?: ThreadMessage["parts"],
  id = "c1"
): ThreadMessage {
  return {
    id,
    role: "coach",
    text,
    createdAt: "2026-08-25T00:00:01.000Z",
    parts,
  }
}

const sampleSnapshot: WorkspaceSnapshot = {
  profileName: "Minh",
  paper: [{ name: "Sample internship CV", kind: "cv", status: "draft" }],
  apply: [
    {
      title: "Associate PM intern",
      company: "Local startup",
      stage: "inbox",
      starred: true,
    },
    {
      title: "Business analyst intern",
      company: "Regional bank",
      stage: "prep",
      starred: false,
    },
  ],
}

describe("personaSystemPrompt", () => {
  it("encodes the PRODUCT.md voice and contains no exclamation marks", () => {
    const persona = personaSystemPrompt()
    expect(persona).not.toMatch(/!/)
    expect(persona).toMatch(/grounded mentor/i)
    expect(persona).toMatch(/Evidence over encouragement/)
    expect(persona).toMatch(/exactly one next step/)
    expect(persona).toMatch(/honest about distance/i)
    expect(persona).toMatch(/Never claim an action succeeded/)
    expect(persona).toMatch(/Never invent ids/)
    expect(persona).toMatch(/not consent to change an Apply card/)
    expect(persona).toMatch(
      /Do not mutate Apply, Paper, or Pitch unless the User asked/
    )
    expect(persona).toMatch(/paper_updateContent/)
    expect(persona).toMatch(/failed tool receipt/)
    expect(persona).toMatch(/Never tell them to paste the rewrite/)
    expect(persona).toMatch(/Never ask whether to apply/)
  })
})

describe("summarizeWorkspace", () => {
  it("writes counts plus a compact list, without ids or exclamation marks", () => {
    const summary = summarizeWorkspace(sampleSnapshot)
    expect(summary).not.toMatch(/!/)
    expect(summary).toContain("Profile: Minh")
    expect(summary).toContain("Paper: 1 document")
    expect(summary).toContain("- Sample internship CV · CV · draft")
    expect(summary).toContain("Apply: 2 cards (1 starred)")
    expect(summary).toContain(
      "- Associate PM intern · Local startup · Inbox · starred"
    )
    expect(summary).toContain(
      "- Business analyst intern · Regional bank · Prep"
    )
    expect(summary).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    )
  })

  it("names Pitch without ids when the runtime loaded it", () => {
    const summary = summarizeWorkspace({
      ...sampleSnapshot,
      pitch: {
        published: false,
        demo: true,
        headline: "Sample Pitch · replace with your story",
        achievements: 2,
        experience: 1,
        highlights: 2,
      },
    })
    expect(summary).toContain(
      "Pitch: sample page · unpublished · Sample Pitch · replace with your story · 2 achievements · 1 experience · 2 moments"
    )
    expect(summary).not.toMatch(/That card id isn't valid/)
    expect(summarizeWorkspace({ ...sampleSnapshot, pitch: null })).toContain(
      "Pitch: none"
    )
  })

  it("caps long lists and reports the remainder", () => {
    const snapshot: WorkspaceSnapshot = {
      profileName: "Lan",
      paper: Array.from({ length: 12 }, (_, index) => ({
        name: `Doc ${index + 1}`,
        kind: "letter" as const,
        status: "draft" as const,
      })),
      apply: Array.from({ length: 20 }, (_, index) => ({
        title: `Role ${index + 1}`,
        company: "Acme",
        stage: "inbox" as const,
        starred: false,
      })),
    }

    const summary = summarizeWorkspace(snapshot)
    expect(summary).toContain(`Paper: 12 documents`)
    expect(summary).toContain(`Apply: 20 cards (0 starred)`)
    expect(summary).toContain(`(+${12 - COACH_WORKSPACE_LIST_CAP} more)`)
    expect(summary).toContain(`(+${20 - COACH_WORKSPACE_LIST_CAP} more)`)
    expect(summary).toContain("- Doc 1 · Letter · draft")
    expect(summary).toContain("- Doc 8 · Letter · draft")
    expect(summary).not.toContain("- Doc 9 · Letter · draft")
    expect(summary).toContain("- Role 8 · Acme · Inbox")
    expect(summary).not.toContain("- Role 9 · Acme · Inbox")
  })
})

describe("assembleSystemPrompt", () => {
  it("joins persona and summary with no exclamation marks", () => {
    const prompt = assembleSystemPrompt(sampleSnapshot)
    expect(prompt.startsWith(personaSystemPrompt())).toBe(true)
    expect(prompt).toContain(summarizeWorkspace(sampleSnapshot))
    expect(prompt).not.toMatch(/!/)
  })

  it("appends a regenerate instruction that keeps prior receipts as facts", () => {
    const prior = coachMessage("Moved it.", [
      { type: "text", text: "Moved it." },
      {
        type: "tool",
        name: "apply_moveCard",
        summary: "Moved Associate PM intern to Prep",
        ok: true,
      },
    ])
    const prompt = assembleSystemPrompt(sampleSnapshot, undefined, {
      regenerateFrom: prior,
    })
    expect(prompt).toContain(regenerateInstruction(prior))
    expect(prompt).toContain("Do not claim they were reversed or undone")
    expect(prompt).toContain(
      "[apply_moveCard ok] Moved Associate PM intern to Prep"
    )
    expect(prompt).not.toMatch(/!/)
  })

  it("names the open Paper document and forbids a silent rewrite", () => {
    const snapshot: WorkspaceSnapshot = {
      ...sampleSnapshot,
      focusDoc: {
        id: "11111111-1111-7111-8111-111111111111",
        name: "PM track CV",
        kind: "cv",
        status: "draft",
        content: {
          templateId: "internship",
          name: "",
          headline: "",
          contact: { email: "", phone: "", location: "" },
          summary: "Year-4 student targeting associate PM roles.",
          experience: [
            {
              role: "Side project · Checkout UX",
              company: "Personal",
              period: "2025",
              bullets: [
                "Audited product card density on a top e-commerce app.",
              ],
            },
          ],
          education: [],
          skills: [],
        },
        contentVersion: 1,
      },
    }
    const summary = summarizeWorkspace(snapshot)
    expect(summary).toContain(
      "Open Paper document: PM track CV · CV · draft (id: 11111111-1111-7111-8111-111111111111)"
    )
    expect(summary).toMatch(/Do not call paper_getDoc/)
    expect(summary).toMatch(/paper_updateContent/)
    expect(summary).toMatch(/never claim a silent rewrite/)
    expect(summary).toMatch(/never ask the User to paste the rewrite/)
    expect(summary).toMatch(/never ask whether to apply/)
    expect(summary).toMatch(/Experience\[0].*Checkout UX/)
    expect(summary).toContain("Year-4 student targeting associate PM roles.")
    expect(summary).not.toMatch(/!/)
    expect(assembleSystemPrompt(snapshot)).toContain(summary)
  })

  it("appends a must-edit instruction for an edit ask, not for Home advice", () => {
    const snapshot: WorkspaceSnapshot = {
      ...sampleSnapshot,
      focusDoc: {
        id: "11111111-1111-7111-8111-111111111111",
        name: "PM track CV",
        kind: "cv",
        status: "draft",
        content: { markdown: "unused" },
        contentVersion: 1,
      },
    }
    const edit = assembleSystemPrompt(snapshot, undefined, {
      latestUserText: "Rewrite this Experience bullet for a product internship",
    })
    expect(edit).toMatch(/This User message is an edit ask/)
    expect(edit).toMatch(/Never ask whether to apply/)

    const advice = assembleSystemPrompt(sampleSnapshot, undefined, {
      latestUserText: "How do I prepare for interviews?",
    })
    expect(advice).not.toMatch(/This User message is an edit ask/)

    const paperAdvice = assembleSystemPrompt(snapshot, undefined, {
      latestUserText: "How do I edit my summary?",
    })
    expect(paperAdvice).not.toMatch(/This User message is an edit ask/)
  })

  it("scopes a Pitch café ask to coaching and forbids Apply card mutations", () => {
    const snapshot: WorkspaceSnapshot = {
      ...sampleSnapshot,
      pitch: {
        published: false,
        demo: true,
        headline: "Sample Pitch · replace with your story",
        achievements: 2,
        experience: 1,
        highlights: 2,
      },
    }
    const prompt = assembleSystemPrompt(snapshot, undefined, {
      latestUserText:
        "What should I put on my Pitch page before I share the link? I have two Proofs ready and a draft CV.",
    })
    expect(prompt).toContain(
      "Pitch: sample page · unpublished · Sample Pitch · replace with your story"
    )
    expect(prompt).toMatch(/This User message is about Pitch, not Apply/)
    expect(prompt).toMatch(/Do not invent Apply card ids/)
    expect(prompt).not.toMatch(/This User message is an edit ask/)
    expect(prompt).not.toMatch(/That card id isn't valid/)

    const applyAsk = assembleSystemPrompt(sampleSnapshot, undefined, {
      latestUserText: "Move my starred card to Prep.",
    })
    expect(applyAsk).not.toMatch(/This User message is about Pitch/)
  })

  it("asks the Coach to prefer the User's selection when one is present", () => {
    const prompt = assembleSystemPrompt(sampleSnapshot, undefined, {
      selection: { text: "Ran weekly problem interviews", sectionId: "summary" },
    })
    expect(prompt).toContain('in section "summary"')
    expect(prompt).toContain("Ran weekly problem interviews")
    expect(prompt).toContain("Prefer editing that selection")
    expect(prompt).not.toMatch(/!/)
  })
})

describe("historyForRegenerate", () => {
  it("drops the latest Coach turn so the model answers the last User message again", () => {
    const user = userMessage("Move the starred card")
    const coach = coachMessage("Moved it.", [
      {
        type: "tool",
        name: "apply_moveCard",
        summary: "Moved Associate PM intern to Prep",
        ok: true,
      },
    ])
    expect(historyForRegenerate([user, coach])).toEqual({
      history: [user],
      priorCoach: coach,
    })
    expect(historyForRegenerate([user])).toEqual({
      history: [user],
      priorCoach: undefined,
    })
  })
})

describe("windowHistory", () => {
  it("keeps the last 40 messages when they fit the character budget", () => {
    const messages = Array.from({ length: 45 }, (_, index) =>
      userMessage(`m${index}`, `id-${index}`)
    )
    const windowed = windowHistory(messages)
    expect(windowed).toHaveLength(COACH_HISTORY_MESSAGE_CAP)
    expect(windowed[0]?.content).toBe("m5")
    expect(windowed.at(-1)?.content).toBe("m44")
    expect(
      windowed.reduce((sum, message) => sum + message.content.length, 0)
    ).toBeLessThanOrEqual(COACH_HISTORY_CHAR_BUDGET)
  })

  it("drops oldest messages first when the character budget is exceeded", () => {
    const messages = [
      userMessage("A".repeat(40), "1"),
      coachMessage("B".repeat(40), undefined, "2"),
      userMessage("C".repeat(40), "3"),
    ]
    const windowed = windowHistory(messages, { charBudget: 90 })
    expect(windowed.map((message) => message.content[0])).toEqual(["B", "C"])
    expect(
      windowed.reduce((sum, message) => sum + message.content.length, 0)
    ).toBeLessThanOrEqual(90)
  })

  it("truncates the newest message when it alone exceeds the budget", () => {
    const windowed = windowHistory([userMessage("X".repeat(50))], {
      charBudget: 12,
    })
    expect(windowed).toEqual([{ role: "user", content: "X".repeat(12) }])
  })

  it("flattens past tool parts to bracketed lines", () => {
    const flattened = flattenMessage(
      coachMessage("Moved it.", [
        { type: "text", text: "I listed Apply first." },
        {
          type: "tool",
          name: "apply_listCards",
          summary: "Listed 2 Apply cards",
          ok: true,
        },
        {
          type: "tool",
          name: "apply_moveCard",
          summary: "Apply card not found",
          ok: false,
        },
      ])
    )
    expect(flattened).toBe(
      [
        "I listed Apply first.",
        "[apply_listCards ok] Listed 2 Apply cards",
        "[apply_moveCard fail] Apply card not found",
      ].join("\n")
    )

    const windowed = windowHistory([
      userMessage("move my starred card to Prep"),
      coachMessage("Moved it.", [
        { type: "text", text: "Moved it." },
        {
          type: "tool",
          name: "apply_moveCard",
          summary: "Moved Associate PM intern at Local startup to Prep",
          ok: true,
        },
      ]),
    ])
    expect(windowed[1]?.role).toBe("assistant")
    expect(windowed[1]?.content).toContain(
      "[apply_moveCard ok] Moved Associate PM intern at Local startup to Prep"
    )
  })
})
