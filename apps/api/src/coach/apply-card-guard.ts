import {
  APPLY_CARD_ID_MISSING_COPY,
  ERROR_CODES,
  PITCH_SCOPED_NO_APPLY_COPY,
  applyCardIdSchema,
  errorEnvelope,
} from "@workspace/domain"
import { z } from "zod"

import { isApplyMutationTool } from "./pitch-scope.js"
import type { CoachTool, CoachToolSurface } from "./tools.js"

/**
 * Provider-facing schema for Apply card mutations. Free models invent
 * nil UUIDs; the Command schema stays strict. Refuse in execute so a
 * Zod dump never becomes "That card id isn't valid" (QVE-247).
 */
export const applyCardMutationCoachInputSchema = z
  .object({
    cardId: z.unknown().optional(),
    applyCardId: z.unknown().optional(),
  })
  .passthrough()

export type ApplyCardGuardOptions = {
  pitchScoped?: boolean
}

function rawCardId(name: string, input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined
  const row = input as Record<string, unknown>
  if (name === "paper_linkApplyCard") return row.applyCardId
  return row.cardId
}

function isListedApplyCardId(value: unknown): value is string {
  return typeof value === "string" && applyCardIdSchema.safeParse(value).success
}

/**
 * Never execute Apply card mutations with a missing or invented id.
 * Pitch-scoped turns refuse every Apply mutation, even create.
 */
export function withApplyCardIdGuard(
  surface: CoachToolSurface,
  options: ApplyCardGuardOptions = {}
): CoachToolSurface {
  const next: CoachToolSurface = { ...surface }

  for (const [name, tool] of Object.entries(surface)) {
    if (!isApplyMutationTool(name)) continue
    next[name] = guardApplyMutation(name, tool, options.pitchScoped === true)
  }

  return next
}

function guardApplyMutation(
  name: string,
  tool: CoachTool,
  pitchScoped: boolean
): CoachTool {
  return {
    description: tool.description,
    inputSchema: applyCardMutationCoachInputSchema,
    execute: async (input) => {
      if (pitchScoped) {
        return errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          PITCH_SCOPED_NO_APPLY_COPY
        )
      }

      if (name === "apply_createCard") {
        return tool.execute(input)
      }

      const cardId = rawCardId(name, input)
      if (name === "paper_linkApplyCard" && cardId === null) {
        return tool.execute(input)
      }
      if (!isListedApplyCardId(cardId)) {
        return errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          APPLY_CARD_ID_MISSING_COPY
        )
      }

      return tool.execute(input)
    },
  }
}
