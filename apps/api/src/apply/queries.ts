import {
  ERROR_CODES,
  publicApplyJobUrl,
  type ApplyCard,
} from "@workspace/domain"
import { and, asc, eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { applyCards } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

export function toApplyCard(row: {
  id: string
  title: string
  company: string
  note: string
  stage: ApplyCard["stage"]
  position: string
  starred: boolean
  jobUrl: string | null
  trackDate: string
  trackKind: ApplyCard["trackKind"]
  createdAt: Date
  updatedAt: Date
}): ApplyCard {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    note: row.note,
    stage: row.stage,
    position: row.position,
    starred: row.starred,
    jobUrl: publicApplyJobUrl(row.jobUrl),
    trackDate: row.trackDate,
    trackKind: row.trackKind,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export async function listApplyCardsForUser(
  db: AppDatabase,
  userId: string
): Promise<ApplyCard[]> {
  const rows = await db
    .select()
    .from(applyCards)
    .where(eq(applyCards.userId, userId))
    .orderBy(asc(applyCards.stage), asc(applyCards.position), asc(applyCards.id))

  return rows.map(toApplyCard)
}

export async function getOwnedApplyCard(
  db: AppDatabase,
  userId: string,
  cardId: string
) {
  const [row] = await db
    .select()
    .from(applyCards)
    .where(eq(applyCards.id, cardId))
    .limit(1)

  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Apply card not found")
  }
  if (row.userId !== userId) {
    throw new CommandError(
      ERROR_CODES.FORBIDDEN,
      "You cannot access this Apply card"
    )
  }

  return row
}

export async function getApplyCardDetail(
  db: AppDatabase,
  userId: string,
  cardId: string
): Promise<ApplyCard> {
  const row = await getOwnedApplyCard(db, userId, cardId)
  return toApplyCard(row)
}

export type ApplyCardRow = typeof applyCards.$inferSelect

export async function listStageNeighbors(
  db: AppDatabase,
  userId: string,
  stage: ApplyCard["stage"],
  excludeCardId?: string
): Promise<ApplyCardRow[]> {
  const rows: ApplyCardRow[] = await db
    .select()
    .from(applyCards)
    .where(
      and(eq(applyCards.userId, userId), eq(applyCards.stage, stage))
    )
    .orderBy(asc(applyCards.position), asc(applyCards.id))

  return excludeCardId
    ? rows.filter((row) => row.id !== excludeCardId)
    : rows
}
