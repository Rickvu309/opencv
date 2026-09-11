import { describe, expect, it } from "vitest"

import {
  APPLY_MUTATION_TOOL_NAMES,
  isApplyCardMutateAsk,
  isPitchCoachAsk,
  omitApplyMutations,
  pitchScopeTurnInstruction,
} from "./pitch-scope.js"

const POLISH_PITCH =
  "What should I put on my Pitch page before I share the link? I have two Proofs ready and a draft CV."

describe("isPitchCoachAsk", () => {
  it("matches the Home Polish Pitch café chip", () => {
    expect(isPitchCoachAsk(POLISH_PITCH)).toBe(true)
    expect(isPitchCoachAsk("Polish my Pitch before I share the link")).toBe(
      true
    )
    expect(isPitchCoachAsk("Help me with my pitch page")).toBe(true)
  })

  it("does not steal Apply mutate or Paper edit asks", () => {
    expect(isPitchCoachAsk("Move my starred card to Prep.")).toBe(false)
    expect(isPitchCoachAsk("Look at my Apply inbox and tell me which roles to prioritize this week and which to drop.")).toBe(false)
    expect(isPitchCoachAsk("Rewrite my summary to be shorter")).toBe(false)
    expect(isPitchCoachAsk("How do I prepare for interviews?")).toBe(false)
    expect(isPitchCoachAsk("")).toBe(false)
  })

  it("keeps an explicit Apply mutate even when Pitch is mentioned", () => {
    expect(
      isPitchCoachAsk("On my Pitch page, move my starred Apply card to Prep")
    ).toBe(false)
    expect(isApplyCardMutateAsk("Move my starred card to Prep.")).toBe(true)
  })
})

describe("omitApplyMutations", () => {
  it("strips Apply card mutations on a Pitch-scoped turn", () => {
    const surface = Object.fromEntries(
      [
        "apply_listCards",
        "apply_moveCard",
        "apply_createCard",
        "paper_updateContent",
        "pitch_update",
        "paper_linkApplyCard",
      ].map((name) => [name, { name }])
    )

    const scoped = omitApplyMutations(surface, true)
    expect(Object.keys(scoped).sort()).toEqual([
      "apply_listCards",
      "paper_updateContent",
      "pitch_update",
    ])
    for (const name of APPLY_MUTATION_TOOL_NAMES) {
      expect(scoped).not.toHaveProperty(name)
    }

    expect(omitApplyMutations(surface, false)).toEqual(surface)
  })
})

describe("pitchScopeTurnInstruction", () => {
  it("forbids Apply card tools and invented ids", () => {
    const instruction = pitchScopeTurnInstruction()
    expect(instruction).not.toMatch(/!/)
    expect(instruction).toMatch(/Pitch, not Apply/)
    expect(instruction).toMatch(/Do not invent Apply card ids/)
    expect(instruction).not.toMatch(/That card id isn't valid/)
  })
})
