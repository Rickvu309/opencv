import { operation } from "@workspace/domain/operations/profile/set-photo"
import { ERROR_CODES, parseFileId } from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"

import { getDb } from "../../../../db/context.js"
import { files } from "../../../../db/schema.js"
import { CommandError } from "../../../../platform/errors.js"
import type { OperationBinding } from "../../../../registry/bind.js"
import { setProfilePhoto } from "../../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    const rows = await getDb()
      .select({ id: files.id, purpose: files.purpose })
      .from(files)
      .where(and(eq(files.id, input.fileId), eq(files.userId, actor.userId)))
      .limit(1)
    const file = rows[0]
    if (!file || file.purpose !== "avatar")
      throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
    return setProfilePhoto(actor.userId, parseFileId(file.id))
  },
  reversal: { irreversible: "The earlier photo is set again by hand." },
  activity: { silent: "A new profile photo leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof setProfilePhoto>>
>
