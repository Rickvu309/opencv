import {
  ERROR_CODES,
  decodePitchContent,
  type PitchDoc,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { pitchDocs } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

export function toPitchDoc(row: {
  id: string
  contentKind: "pitch"
  content: unknown
  contentVersion: number
  createdAt: Date
  updatedAt: Date
}): PitchDoc {
  const decoded = decodePitchContent(
    row.contentKind,
    row.contentVersion,
    row.content
  )
  return {
    id: row.id,
    kind: row.contentKind,
    content: decoded.ok ? decoded.data : row.content,
    contentVersion: row.contentVersion,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export async function getPitchDocForUser(
  db: AppDatabase,
  userId: string
) {
  const [row] = await db
    .select()
    .from(pitchDocs)
    .where(eq(pitchDocs.userId, userId))
    .limit(1)

  return row ?? null
}

export async function requirePitchDocForUser(
  db: AppDatabase,
  userId: string
) {
  const row = await getPitchDocForUser(db, userId)
  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Pitch document not found")
  }
  return row
}

export async function getPitchDocDetail(
  db: AppDatabase,
  userId: string
): Promise<PitchDoc> {
  const row = await requirePitchDocForUser(db, userId)
  return toPitchDoc(row)
}
