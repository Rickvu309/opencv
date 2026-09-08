import {
  ERROR_CODES,
  PITCH_COMMANDS,
  PITCH_CONTENT_KIND,
  PITCH_CONTENT_VERSION,
  decodePitchContent,
  emptyPitchDocument,
  pitchUpdateInputSchema,
  type PitchDoc,
  type PitchDocument,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { pitchDocs } from "../db/schema.js"
import { createId } from "../id.js"
import { getPitchDocForUser, toPitchDoc } from "../pitch/queries.js"
import { CommandError, defineCommand } from "./registry.js"

function requireContent(
  version: number,
  content: unknown
): PitchDocument {
  const decoded = decodePitchContent(PITCH_CONTENT_KIND, version, content)
  if (!decoded.ok) {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, decoded.message)
  }
  return decoded.data
}

export const updatePitchCommand = defineCommand({
  name: PITCH_COMMANDS.update,
  description:
    "Replace the user's Pitch document. Send the complete Pitch JSON for the current contentVersion.",
  input: pitchUpdateInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PITCH_COMMANDS.update,
    description: "Undo by writing the previous Pitch content back.",
  },
  captureForReversal(ctx) {
    return getPitchDocForUser(ctx.db, ctx.actor.userId)
  },
  reversalInput({ captured }) {
    const doc = captured as Awaited<ReturnType<typeof getPitchDocForUser>>
    if (!doc) {
      return {
        content: emptyPitchDocument(),
        contentVersion: PITCH_CONTENT_VERSION,
      }
    }
    return {
      content: doc.content,
      contentVersion: doc.contentVersion,
    }
  },
  async handler(ctx, input): Promise<PitchDoc> {
    const content = requireContent(input.contentVersion, input.content)
    const existing = await getPitchDocForUser(ctx.db, ctx.actor.userId)
    const now = new Date()

    if (!existing) {
      const row = {
        id: createId(),
        userId: ctx.actor.userId,
        contentKind: PITCH_CONTENT_KIND,
        content: content as Record<string, unknown>,
        contentVersion: input.contentVersion,
        createdAt: now,
        updatedAt: now,
      }
      await ctx.db.insert(pitchDocs).values(row)
      return toPitchDoc(row)
    }

    await ctx.db
      .update(pitchDocs)
      .set({
        content: content as Record<string, unknown>,
        contentVersion: input.contentVersion,
        updatedAt: now,
      })
      .where(eq(pitchDocs.id, existing.id))

    return toPitchDoc({
      ...existing,
      content,
      contentVersion: input.contentVersion,
      updatedAt: now,
    })
  },
})

export const pitchCommands = [updatePitchCommand]
