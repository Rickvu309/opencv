import {
  APPLY_CARD_ID_MISSING_COPY,
  INVALID_CARD_ID_COPY,
  PITCH_SCOPED_NO_APPLY_COPY,
  applyMoveCardInputSchema,
  paperLinkApplyCardInputSchema,
  type CommandEnvelope,
} from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { withApplyCardIdGuard } from "./apply-card-guard.js"
import type { CoachToolSurface } from "./tools.js"

const OWNED_CARD_ID = "11111111-1111-7111-8111-111111111111"
const INVENTED_CARD_ID = "00000000-0000-0000-0000-000000000002"

function okEnvelope(): CommandEnvelope {
  return { ok: true, data: { title: "Associate PM intern" } }
}

function failEnvelope(): CommandEnvelope {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", message: "should not run" },
  }
}

function surfaceWith(
  execute: (input: unknown) => Promise<CommandEnvelope>
): CoachToolSurface {
  return {
    apply_moveCard: {
      description: "Move an Apply card.",
      inputSchema: applyMoveCardInputSchema,
      execute,
    },
    apply_createCard: {
      description: "Create an Apply card.",
      inputSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
      execute,
    },
    paper_linkApplyCard: {
      description: "Link a Paper doc to an Apply card.",
      inputSchema: paperLinkApplyCardInputSchema,
      execute,
    },
    apply_listCards: {
      description: "List Apply cards.",
      inputSchema: { safeParse: () => ({ success: true, data: {} }) } as never,
      execute,
    },
  }
}

describe("withApplyCardIdGuard", () => {
  it("refuses a missing or invented card id and never executes", async () => {
    const execute = vi.fn(async () => failEnvelope())
    const tools = withApplyCardIdGuard(surfaceWith(execute))

    const missing = await tools.apply_moveCard.execute({ stage: "prep" })
    const invented = await tools.apply_moveCard.execute({
      cardId: INVENTED_CARD_ID,
      stage: "prep",
    })
    const blank = await tools.apply_moveCard.execute({
      cardId: "",
      stage: "prep",
    })

    expect(execute).not.toHaveBeenCalled()
    expect(missing).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: APPLY_CARD_ID_MISSING_COPY,
      },
    })
    expect(invented).toEqual(missing)
    expect(blank).toEqual(missing)
    expect(APPLY_CARD_ID_MISSING_COPY).not.toBe(INVALID_CARD_ID_COPY)
  })

  it("runs a listed UUID through the Command", async () => {
    const execute = vi.fn(async () => okEnvelope())
    const tools = withApplyCardIdGuard(surfaceWith(execute))
    const input = { cardId: OWNED_CARD_ID, stage: "prep" }

    await expect(tools.apply_moveCard.execute(input)).resolves.toEqual(
      okEnvelope()
    )
    expect(execute).toHaveBeenCalledWith(input)
  })

  it("refuses every Apply mutation on a Pitch-scoped turn", async () => {
    const execute = vi.fn(async () => okEnvelope())
    const tools = withApplyCardIdGuard(surfaceWith(execute), {
      pitchScoped: true,
    })

    const move = await tools.apply_moveCard.execute({
      cardId: OWNED_CARD_ID,
      stage: "prep",
    })
    const created = await tools.apply_createCard.execute({
      title: "Invented",
      company: "Nope",
    })

    expect(execute).not.toHaveBeenCalled()
    expect(move).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: PITCH_SCOPED_NO_APPLY_COPY,
      },
    })
    expect(created).toEqual(move)
    expect(PITCH_SCOPED_NO_APPLY_COPY).not.toMatch(/That card id isn't valid/)
  })

  it("lets unlink (null applyCardId) through and leaves reads alone", async () => {
    const execute = vi.fn(async () => okEnvelope())
    const tools = withApplyCardIdGuard(surfaceWith(execute))

    await tools.paper_linkApplyCard.execute({
      docId: OWNED_CARD_ID,
      applyCardId: null,
    })
    await tools.apply_listCards.execute({})

    expect(execute).toHaveBeenCalledTimes(2)
  })
})
