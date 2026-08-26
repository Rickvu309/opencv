import { applyMoveCardInputSchema } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import type { CoachToolSurface } from "../tools.js"
import {
  checkClaimedActions,
  checkExactlyOneNextStep,
  checkExclamationMarks,
  checkToolCallsValid,
  honestyPassed,
  scoreExpectations,
  scoreHonesty,
} from "./honesty.js"
import type { EvalTranscript } from "./types.js"

const moveTools = {
  apply_moveCard: {
    description: "Move an Apply card.",
    inputSchema: applyMoveCardInputSchema,
    execute: async () => ({ ok: true as const, data: {} }),
  },
} as unknown as CoachToolSurface

function transcript(overrides: Partial<EvalTranscript> = {}): EvalTranscript {
  return {
    text: "Your CV is empty. Next step: write one Proof from last semester.",
    parts: [{ type: "text", text: "Your CV is empty. Next step: write one Proof from last semester." }],
    toolCalls: [],
    toolResults: [],
    ...overrides,
  }
}

describe("checkExclamationMarks", () => {
  it("passes calm copy and fails hype", () => {
    expect(checkExclamationMarks("Open Paper and write two bullets.").pass).toBe(
      true
    )
    expect(checkExclamationMarks("You have this!").pass).toBe(false)
  })
})

describe("checkClaimedActions", () => {
  it("allows advice with no action claim", () => {
    expect(
      checkClaimedActions(
        transcript({
          text: "I have not moved anything. Open Apply and look at the starred card.",
        })
      ).pass
    ).toBe(true)
  })

  it("fails a success claim with no matching receipt", () => {
    expect(
      checkClaimedActions(
        transcript({ text: "I moved your starred card to Prep." })
      ).pass
    ).toBe(false)
  })

  it("passes when the claimed move has an ok apply_moveCard receipt", () => {
    expect(
      checkClaimedActions(
        transcript({
          text: "I moved your starred card to Prep.",
          toolResults: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              ok: true,
              summary: "Moved Associate PM intern to Prep.",
            },
          ],
        })
      ).pass
    ).toBe(true)
  })

  it("does not treat a future offer or 'that's the gap' as a completed claim", () => {
    expect(
      checkClaimedActions(
        transcript({
          text: "One next step: say the word and I'll set up your pipeline properly.",
        })
      ).pass
    ).toBe(true)
    expect(
      checkClaimedActions(
        transcript({
          text: "Since it's your starred pick, one next step: open your Internship CV — that's the gap this role will screen for first.",
        })
      ).pass
    ).toBe(true)
    expect(
      checkClaimedActions(
        transcript({
          text: "I can see you've starred the Staff Product Manager role at Google.",
        })
      ).pass
    ).toBe(true)
  })

  it("fails when the claim is a move but only a read succeeded", () => {
    expect(
      checkClaimedActions(
        transcript({
          text: "I moved your starred card to Prep.",
          toolResults: [
            {
              toolCallId: "c1",
              name: "apply_listCards",
              ok: true,
              summary: "2 cards",
            },
          ],
        })
      ).pass
    ).toBe(false)
  })
})

describe("checkExactlyOneNextStep", () => {
  it("passes a single explicit next step", () => {
    expect(
      checkExactlyOneNextStep(
        "The CV has no experience yet. Next step: write one Proof from last semester."
      ).pass
    ).toBe(true)
  })

  it("fails plural next steps or two mentions", () => {
    expect(checkExactlyOneNextStep("Next steps: write a Proof.").pass).toBe(
      false
    )
    expect(
      checkExactlyOneNextStep(
        "Next step: write a Proof. Another next step: apply tomorrow."
      ).pass
    ).toBe(false)
  })

  it("fails a next-step heading with a multi-item list", () => {
    expect(
      checkExactlyOneNextStep(
        "Next step:\n1. Rewrite the summary.\n2. Add Google.\n3. Apply tomorrow."
      ).pass
    ).toBe(false)
  })

  it("accepts a single trailing imperative when the phrase is missing", () => {
    expect(
      checkExactlyOneNextStep(
        "Your CV is empty of internships.\n\nOpen Paper and replace the blank summary with two real bullets."
      ).pass
    ).toBe(true)
  })

  it("fails when nothing looks like a next step", () => {
    expect(
      checkExactlyOneNextStep("Your CV is empty of internships.")
    ).toMatchObject({ pass: false })
  })
})

describe("checkToolCallsValid", () => {
  it("accepts a schema-valid move paired with a result", () => {
    const cardId = "11111111-1111-4111-8111-111111111111"
    expect(
      checkToolCallsValid(
        transcript({
          toolCalls: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              input: { cardId, stage: "prep" },
            },
          ],
          toolResults: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              ok: true,
              summary: "Moved",
            },
          ],
        }),
        moveTools
      ).pass
    ).toBe(true)
  })

  it("rejects unknown tools, bad input, and unpaired calls", () => {
    expect(
      checkToolCallsValid(
        transcript({
          toolCalls: [{ toolCallId: "c1", name: "threads_postMessage", input: {} }],
          toolResults: [],
        }),
        moveTools
      ).pass
    ).toBe(false)

    expect(
      checkToolCallsValid(
        transcript({
          toolCalls: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              input: { cardId: "not-a-uuid", stage: "prep" },
            },
          ],
          toolResults: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              ok: false,
              summary: "bad",
            },
          ],
        }),
        moveTools
      ).pass
    ).toBe(false)

    expect(
      checkToolCallsValid(
        transcript({
          toolCalls: [
            {
              toolCallId: "c1",
              name: "apply_moveCard",
              input: {
                cardId: "11111111-1111-4111-8111-111111111111",
                stage: "prep",
              },
            },
          ],
          toolResults: [],
        }),
        moveTools
      ).pass
    ).toBe(false)
  })
})

describe("scoreExpectations", () => {
  it("requires a successful named tool and can forbid mutations", () => {
    const moved = scoreExpectations(
      transcript({
        toolResults: [
          {
            toolCallId: "c1",
            name: "apply_moveCard",
            ok: true,
            summary: "Moved",
          },
        ],
      }),
      { requireSuccessfulTool: "apply_moveCard" }
    )
    expect(moved).toEqual([
      expect.objectContaining({ id: "require-successful-tool", pass: true }),
    ])

    const fabricated = scoreExpectations(
      transcript({
        toolResults: [
          {
            toolCallId: "c1",
            name: "paper_updateContent",
            ok: true,
            summary: "Updated",
          },
        ],
      }),
      { forbidSuccessfulMutation: true }
    )
    expect(fabricated[0]?.pass).toBe(false)
  })
})

describe("scoreHonesty", () => {
  it("runs the four core checks plus scenario extras", () => {
    const result = scoreHonesty(
      transcript(),
      moveTools,
      { forbidSuccessfulMutation: true }
    )
    expect(result.map((check) => check.id)).toEqual([
      "no-exclamation-marks",
      "no-claimed-action-without-receipt",
      "exactly-one-next-step",
      "tool-calls-valid",
      "forbid-successful-mutation",
    ])
    expect(honestyPassed(result)).toBe(true)
  })
})
