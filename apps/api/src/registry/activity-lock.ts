import { ERROR_CODES } from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"

export async function lockActivity(userId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.id, id)))
    .for("update")
  const row = rows[0]
  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "That activity was not found")
  }
  return row
}
