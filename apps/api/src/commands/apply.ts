import {
  APPLY_COMMANDS,
  DEFAULT_APPLY_COMPANY,
  DEFAULT_APPLY_TITLE,
  ERROR_CODES,
  applyCreateCardInputSchema,
  applyDeleteCardInputSchema,
  applyMoveCardInputSchema,
  applyToggleStarInputSchema,
  applyUpdateCardInputSchema,
  generateKeyBetween,
  publicApplyJobUrl,
  type ApplyCard,
  type ApplyCardDeleted,
  type ApplyStage,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getOwnedApplyCard, listStageNeighbors, toApplyCard } from "../apply/queries.js"
import { applyCards } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError, defineCommand } from "./registry.js"

function ownedCard(cardId: string, userId: string) {
  return and(eq(applyCards.id, cardId), eq(applyCards.userId, userId))
}

function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

async function positionBefore(
  db: Parameters<typeof listStageNeighbors>[0],
  userId: string,
  stage: ApplyStage,
  beforeCardId: string | null | undefined,
  excludeCardId?: string
) {
  const neighbors = await listStageNeighbors(db, userId, stage, excludeCardId)

  if (beforeCardId == null) {
    const last = neighbors.at(-1)
    return generateKeyBetween(last?.position ?? null, null)
  }

  const index = neighbors.findIndex((row) => row.id === beforeCardId)
  if (index === -1) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "beforeCardId must be another card in the target Stage"
    )
  }

  const right = neighbors[index]!
  const left = index > 0 ? neighbors[index - 1]! : null
  return generateKeyBetween(left?.position ?? null, right.position)
}

export const createApplyCardCommand = defineCommand({
  name: APPLY_COMMANDS.createCard,
  description: "Create a new Apply card in the pipeline.",
  input: applyCreateCardInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: APPLY_COMMANDS.deleteCard,
    description: "Undo by deleting the Apply card.",
  },
  reversalInput({ output }: { output: ApplyCard }) {
    return { cardId: output.id }
  },
  async handler(ctx, input): Promise<ApplyCard> {
    const stage = input.stage ?? "inbox"
    const now = new Date()
    const position = await positionBefore(
      ctx.db,
      ctx.actor.userId,
      stage,
      null
    )

    const row = {
      id: createId(),
      userId: ctx.actor.userId,
      title: input.title ?? DEFAULT_APPLY_TITLE,
      company: input.company ?? DEFAULT_APPLY_COMPANY,
      note: input.note ?? "",
      stage,
      position,
      starred: input.starred ?? false,
      jobUrl: publicApplyJobUrl(input.jobUrl ?? null),
      trackDate: input.trackDate ?? todayIsoDate(now),
      trackKind: input.trackKind ?? "followup",
      fit: 0,
      createdAt: now,
      updatedAt: now,
    }

    await ctx.db.insert(applyCards).values(row)
    return toApplyCard(row)
  },
})

export const updateApplyCardCommand = defineCommand({
  name: APPLY_COMMANDS.updateCard,
  description:
    "Update an Apply card's title, company, note, job URL, or Track. Fit is not writable.",
  input: applyUpdateCardInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: APPLY_COMMANDS.updateCard,
    description: "Undo by writing the previous card fields back.",
  },
  captureForReversal(ctx, input) {
    return getOwnedApplyCard(ctx.db, ctx.actor.userId, input.cardId)
  },
  reversalInput({ captured }) {
    const card = captured as Awaited<ReturnType<typeof getOwnedApplyCard>>
    return {
      cardId: card.id,
      title: card.title,
      company: card.company,
      note: card.note,
      jobUrl: card.jobUrl,
      trackDate: card.trackDate,
      trackKind: card.trackKind,
    }
  },
  async handler(ctx, input): Promise<ApplyCard> {
    const existing = await getOwnedApplyCard(
      ctx.db,
      ctx.actor.userId,
      input.cardId
    )
    const updatedAt = new Date()
    const next = {
      title: input.title ?? existing.title,
      company: input.company ?? existing.company,
      note: input.note ?? existing.note,
      jobUrl:
        input.jobUrl !== undefined
          ? publicApplyJobUrl(input.jobUrl)
          : publicApplyJobUrl(existing.jobUrl),
      trackDate: input.trackDate ?? existing.trackDate,
      trackKind: input.trackKind ?? existing.trackKind,
      updatedAt,
    }

    await ctx.db
      .update(applyCards)
      .set(next)
      .where(ownedCard(existing.id, ctx.actor.userId))

    return toApplyCard({
      ...existing,
      ...next,
    })
  },
})

export const moveApplyCardCommand = defineCommand({
  name: APPLY_COMMANDS.moveCard,
  description:
    "Move an Apply card to a Stage and position. Omit beforeCardId to place it at the end of the Stage.",
  input: applyMoveCardInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: APPLY_COMMANDS.moveCard,
    description: "Undo by moving the card back to its previous Stage and order.",
  },
  async captureForReversal(ctx, input) {
    const existing = await getOwnedApplyCard(
      ctx.db,
      ctx.actor.userId,
      input.cardId
    )
    const neighbors = await listStageNeighbors(
      ctx.db,
      ctx.actor.userId,
      existing.stage
    )
    const index = neighbors.findIndex((row) => row.id === existing.id)
    const after = index >= 0 ? neighbors[index + 1] : undefined
    return {
      cardId: existing.id,
      stage: existing.stage,
      beforeCardId: after?.id ?? null,
    }
  },
  reversalInput({ captured }) {
    return captured
  },
  async handler(ctx, input): Promise<ApplyCard> {
    if (input.beforeCardId === input.cardId) {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "A card cannot be placed before itself"
      )
    }

    const existing = await getOwnedApplyCard(
      ctx.db,
      ctx.actor.userId,
      input.cardId
    )
    const position = await positionBefore(
      ctx.db,
      ctx.actor.userId,
      input.stage,
      input.beforeCardId,
      existing.id
    )
    const updatedAt = new Date()

    await ctx.db
      .update(applyCards)
      .set({
        stage: input.stage,
        position,
        updatedAt,
      })
      .where(ownedCard(existing.id, ctx.actor.userId))

    return toApplyCard({
      ...existing,
      stage: input.stage,
      position,
      updatedAt,
    })
  },
})

export const toggleApplyStarCommand = defineCommand({
  name: APPLY_COMMANDS.toggleStar,
  description: "Star or unstar an Apply card.",
  input: applyToggleStarInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: APPLY_COMMANDS.toggleStar,
    description: "Undo by toggling the star again.",
  },
  reversalInput({ input }) {
    return { cardId: input.cardId }
  },
  async handler(ctx, input): Promise<ApplyCard> {
    const existing = await getOwnedApplyCard(
      ctx.db,
      ctx.actor.userId,
      input.cardId
    )
    const updatedAt = new Date()
    const starred = !existing.starred

    await ctx.db
      .update(applyCards)
      .set({ starred, updatedAt })
      .where(ownedCard(existing.id, ctx.actor.userId))

    return toApplyCard({
      ...existing,
      starred,
      updatedAt,
    })
  },
})

export const deleteApplyCardCommand = defineCommand({
  name: APPLY_COMMANDS.deleteCard,
  description:
    "Permanently delete an Apply card. The Coach cannot run this.",
  input: applyDeleteCardInputSchema,
  coachAllowed: false,
  destructive: true,
  reversal: {
    possible: false,
    description: "Deleting an Apply card permanently removes it.",
  },
  async handler(ctx, input): Promise<ApplyCardDeleted> {
    const existing = await getOwnedApplyCard(
      ctx.db,
      ctx.actor.userId,
      input.cardId
    )

    await ctx.db
      .delete(applyCards)
      .where(ownedCard(existing.id, ctx.actor.userId))
    return { id: existing.id }
  },
})

export const applyCommands = [
  createApplyCardCommand,
  updateApplyCardCommand,
  moveApplyCardCommand,
  toggleApplyStarCommand,
  deleteApplyCardCommand,
]
