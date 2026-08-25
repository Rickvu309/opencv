import {
  PAPER_CONTENT_VERSION,
  generateKeyBetween,
  isoDateFromOffset,
  starterApplyCards,
  starterCvContent,
  starterThread,
  STARTER_CV_NAME,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import {
  applyCards,
  paperDocs,
  threadMessages,
  threads,
} from "../db/schema.js"
import { createId } from "../id.js"
import type { AppDatabase } from "../commands/registry.js"

export type StarterWorkspaceSeed = {
  created: boolean
  paperDocId: string | null
  applyCardIds: string[]
  threadId: string | null
}

const skipped: StarterWorkspaceSeed = {
  created: false,
  paperDocId: null,
  applyCardIds: [],
  threadId: null,
}

/**
 * Neutral starter workspace for a brand-new account (ADR-0006).
 * Idempotent: skips when the User already has Paper, Apply, or Threads.
 */
export async function seedStarterWorkspace(
  db: AppDatabase,
  userId: string,
  now = new Date()
): Promise<StarterWorkspaceSeed> {
  return db.transaction(async (tx: AppDatabase) => {
    const [existingPaper, existingApply, existingThread] = await Promise.all([
      tx
        .select({ id: paperDocs.id })
        .from(paperDocs)
        .where(eq(paperDocs.userId, userId))
        .limit(1),
      tx
        .select({ id: applyCards.id })
        .from(applyCards)
        .where(eq(applyCards.userId, userId))
        .limit(1),
      tx
        .select({ id: threads.id })
        .from(threads)
        .where(eq(threads.userId, userId))
        .limit(1),
    ])

    if (existingPaper[0] || existingApply[0] || existingThread[0]) {
      return skipped
    }

    const paperId = createId(now.getTime())
    const applyDrafts = starterApplyCards()
    const applyRows = applyDrafts.map((draft, index) => {
      const createdAt = new Date(now.getTime() + index + 1)
      return {
        id: createId(createdAt.getTime()),
        userId,
        title: draft.title,
        company: draft.company,
        note: draft.note,
        stage: draft.stage,
        position: generateKeyBetween(null, null),
        starred: draft.starred,
        jobUrl: draft.jobUrl,
        trackDate: isoDateFromOffset(now, draft.trackOffsetDays),
        trackKind: draft.trackKind,
        fit: 0,
        createdAt,
        updatedAt: createdAt,
      }
    })

    const threadCreated = new Date(now.getTime() + applyRows.length + 1)
    const threadId = createId(threadCreated.getTime())
    const coachAt = new Date(threadCreated.getTime() + 1)
    const welcome = starterThread()

    await tx.insert(paperDocs).values({
      id: paperId,
      userId,
      name: STARTER_CV_NAME,
      contentKind: "cv",
      content: starterCvContent(),
      contentVersion: PAPER_CONTENT_VERSION,
      status: "draft",
      applyCardId: null,
      createdAt: now,
      updatedAt: now,
    })

    if (applyRows.length > 0) {
      await tx.insert(applyCards).values(applyRows)
    }

    await tx.insert(threads).values({
      id: threadId,
      userId,
      title: welcome.title,
      createdAt: threadCreated,
      updatedAt: threadCreated,
    })
    await tx.insert(threadMessages).values({
      id: createId(coachAt.getTime()),
      threadId,
      role: "coach",
      text: welcome.coachText,
      createdAt: coachAt,
    })

    return {
      created: true,
      paperDocId: paperId,
      applyCardIds: applyRows.map((row) => row.id),
      threadId,
    }
  })
}
