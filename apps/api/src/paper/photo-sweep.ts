import { sql } from "drizzle-orm"

import { getDb } from "../db/context.js"

const UNATTACHED_AVATAR_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function sweepUnattachedPhotos(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - UNATTACHED_AVATAR_MAX_AGE_MS)
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const deleted = await getDb().execute<{ id: string }>(sql`
        delete from opencv_app.files as f
        where f.purpose = 'avatar'
          and f.created_at < ${cutoff}
          and not exists (
            select 1 from opencv_app.photo_refs as r
            where r.file_id = f.id
          )
        returning f.id
      `)
      return deleted.rows.map((row) => String(row.id))
    } catch (error) {
      last = error
      if (!foreignKeyViolation(error)) throw error
    }
  }
  throw last
}

export { attachPhoto } from "./store.js"

function foreignKeyViolation(error: unknown) {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    if ("code" in current && current.code === "23503") return true
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : undefined
  }
  const message = error instanceof Error ? error.message : ""
  return /foreign key|violates foreign key/i.test(message)
}
