import {
  ERROR_CODES,
  approvedProposalActor,
  coachActor,
  delegateActorSchema,
  personActor,
  type Actor,
} from "@workspace/domain"
import type { ZodType } from "zod"

import { CommandError } from "../platform/errors.js"

function zodMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input"
}

export function parseInput<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      zodMessage(parsed.error)
    )
  }
  return parsed.data
}

export function brandedActor(actor: Actor): Actor {
  if (actor.type === "delegate") return delegateActorSchema.parse(actor)
  if (actor.type === "person") return personActor(actor.userId)
  return actor.turnId
    ? coachActor(actor.userId, actor.chatId, actor.turnId)
    : approvedProposalActor(actor.userId, actor.chatId)
}
