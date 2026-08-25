import {
  DEFAULT_PAPER_DOC_NAME,
  ERROR_CODES,
  PAPER_COMMANDS,
  PAPER_CONTENT_VERSION,
  decodePaperContent,
  emptyPaperDocument,
  paperCreateDocInputSchema,
  paperDeleteDocInputSchema,
  paperLinkApplyCardInputSchema,
  paperRenameDocInputSchema,
  paperSetStatusInputSchema,
  paperUpdateContentInputSchema,
  type PaperDoc,
  type PaperDocDeleted,
  type PaperDocument,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { paperDocs } from "../db/schema.js"
import { createId } from "../id.js"
import { getOwnedApplyCard } from "../apply/queries.js"
import { getOwnedPaperDoc, toPaperDoc } from "../paper/queries.js"
import { CommandError, defineCommand } from "./registry.js"

function ownedDoc(docId: string, userId: string) {
  return and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId))
}

function requireContent(
  kind: PaperDoc["kind"],
  version: number,
  content: unknown
): PaperDocument {
  const decoded = decodePaperContent(kind, version, content)
  if (!decoded.ok) {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, decoded.message)
  }
  return decoded.data
}

export const createPaperDocCommand = defineCommand({
  name: PAPER_COMMANDS.createDoc,
  input: paperCreateDocInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PAPER_COMMANDS.deleteDoc,
    description: "Undo by deleting the Paper doc.",
  },
  async handler(ctx, input): Promise<PaperDoc> {
    const content =
      input.content === undefined
        ? emptyPaperDocument(input.kind)
        : requireContent(input.kind, PAPER_CONTENT_VERSION, input.content)

    const now = new Date()
    const row = {
      id: createId(),
      userId: ctx.actor.userId,
      name: input.name ?? DEFAULT_PAPER_DOC_NAME[input.kind],
      contentKind: input.kind,
      content: content as Record<string, unknown>,
      contentVersion: PAPER_CONTENT_VERSION,
      status: "draft" as const,
      applyCardId: null,
      createdAt: now,
      updatedAt: now,
    }

    await ctx.db.insert(paperDocs).values(row)
    return toPaperDoc(row)
  },
})

export const updatePaperContentCommand = defineCommand({
  name: PAPER_COMMANDS.updateContent,
  input: paperUpdateContentInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PAPER_COMMANDS.updateContent,
    description: "Undo by writing the previous content back.",
  },
  async handler(ctx, input): Promise<PaperDoc> {
    const existing = await getOwnedPaperDoc(
      ctx.db,
      ctx.actor.userId,
      input.docId
    )
    const content = requireContent(
      existing.contentKind,
      input.contentVersion,
      input.content
    )
    const updatedAt = new Date()

    await ctx.db
      .update(paperDocs)
      .set({
        content: content as Record<string, unknown>,
        contentVersion: input.contentVersion,
        updatedAt,
      })
      .where(ownedDoc(existing.id, ctx.actor.userId))

    return toPaperDoc({
      ...existing,
      content,
      contentVersion: input.contentVersion,
      updatedAt,
    })
  },
})

export const renamePaperDocCommand = defineCommand({
  name: PAPER_COMMANDS.renameDoc,
  input: paperRenameDocInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PAPER_COMMANDS.renameDoc,
    description: "Undo by renaming the Paper doc back to its previous name.",
  },
  async handler(ctx, input): Promise<PaperDoc> {
    const existing = await getOwnedPaperDoc(
      ctx.db,
      ctx.actor.userId,
      input.docId
    )
    const updatedAt = new Date()

    await ctx.db
      .update(paperDocs)
      .set({ name: input.name, updatedAt })
      .where(ownedDoc(existing.id, ctx.actor.userId))

    return toPaperDoc({
      ...existing,
      name: input.name,
      updatedAt,
    })
  },
})

export const setPaperStatusCommand = defineCommand({
  name: PAPER_COMMANDS.setStatus,
  input: paperSetStatusInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PAPER_COMMANDS.setStatus,
    description: "Undo by setting the previous status.",
  },
  async handler(ctx, input): Promise<PaperDoc> {
    const existing = await getOwnedPaperDoc(
      ctx.db,
      ctx.actor.userId,
      input.docId
    )
    const updatedAt = new Date()

    await ctx.db
      .update(paperDocs)
      .set({ status: input.status, updatedAt })
      .where(ownedDoc(existing.id, ctx.actor.userId))

    return toPaperDoc({
      ...existing,
      status: input.status,
      updatedAt,
    })
  },
})

export const linkPaperApplyCardCommand = defineCommand({
  name: PAPER_COMMANDS.linkApplyCard,
  input: paperLinkApplyCardInputSchema,
  coachAllowed: true,
  destructive: false,
  reversal: {
    possible: true,
    command: PAPER_COMMANDS.linkApplyCard,
    description: "Undo by linking the previous Apply card, or unlinking.",
  },
  async handler(ctx, input): Promise<PaperDoc> {
    const existing = await getOwnedPaperDoc(
      ctx.db,
      ctx.actor.userId,
      input.docId
    )

    if (input.applyCardId) {
      await getOwnedApplyCard(ctx.db, ctx.actor.userId, input.applyCardId)
    }

    const updatedAt = new Date()
    await ctx.db
      .update(paperDocs)
      .set({ applyCardId: input.applyCardId, updatedAt })
      .where(ownedDoc(existing.id, ctx.actor.userId))

    return toPaperDoc({
      ...existing,
      applyCardId: input.applyCardId,
      updatedAt,
    })
  },
})

export const deletePaperDocCommand = defineCommand({
  name: PAPER_COMMANDS.deleteDoc,
  input: paperDeleteDocInputSchema,
  coachAllowed: false,
  destructive: true,
  reversal: {
    possible: false,
    description: "Deleting a Paper doc permanently removes its content.",
  },
  async handler(ctx, input): Promise<PaperDocDeleted> {
    const existing = await getOwnedPaperDoc(
      ctx.db,
      ctx.actor.userId,
      input.docId
    )

    await ctx.db
      .delete(paperDocs)
      .where(ownedDoc(existing.id, ctx.actor.userId))
    return { id: existing.id }
  },
})

export const paperCommands = [
  createPaperDocCommand,
  updatePaperContentCommand,
  renamePaperDocCommand,
  setPaperStatusCommand,
  linkPaperApplyCardCommand,
  deletePaperDocCommand,
]
