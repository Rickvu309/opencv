import {
  ERROR_CODES,
  decodePitchContent,
  isPitchPublicSlug,
  pitchHandle,
  type PitchDoc,
  type PublicPitch,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { pitchDocs, user } from "../db/schema.js"

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

export async function getPublishedPitchBySlug(
  db: AppDatabase,
  slug: string
): Promise<PublicPitch | null> {
  if (!isPitchPublicSlug(slug)) return null

  const rows = await db
    .select({
      contentKind: pitchDocs.contentKind,
      content: pitchDocs.content,
      contentVersion: pitchDocs.contentVersion,
      createdAt: pitchDocs.createdAt,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(pitchDocs)
    .innerJoin(user, eq(pitchDocs.userId, user.id))

  const matches = rows.flatMap((row) => {
    if (pitchHandle(row.name) !== slug) return []
    const decoded = decodePitchContent(
      row.contentKind,
      row.contentVersion,
      row.content
    )
    if (!decoded.ok || !decoded.data.published) return []
    return [{ row, content: decoded.data }]
  })

  matches.sort((a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime())
  const hit = matches[0]
  if (!hit) return null

  return {
    slug,
    author: {
      name: hit.row.name,
      email: hit.row.email,
      image: hit.row.image,
    },
    kind: hit.row.contentKind,
    content: hit.content,
    contentVersion: hit.row.contentVersion,
  }
}
