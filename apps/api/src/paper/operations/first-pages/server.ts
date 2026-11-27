import { operation } from "@workspace/domain/operations/paper/first-pages"
import { layoutPageSchema } from "@workspace/domain/paper-doc"
import { and, eq, inArray, isNotNull } from "drizzle-orm"

import { getDb } from "../../../db/context.js"
import { paperDocs } from "../../../db/schema.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { NEW_ENGINE } from "../../log/index.js"

export const implementation = {
  operation,
  async execute({ ids }, actor) {
    if (!ids.length) return []
    const rows = await getDb()
      .select({ id: paperDocs.id, page: paperDocs.firstPage })
      .from(paperDocs)
      .where(
        and(
          eq(paperDocs.userId, actor.userId),
          eq(paperDocs.engine, NEW_ENGINE),
          inArray(paperDocs.id, ids),
          isNotNull(paperDocs.firstPage)
        )
      )
    return rows.flatMap(({ id, page }) => {
      const stored = layoutPageSchema.safeParse(page)
      return stored.success ? [{ id, page: stored.data }] : []
    })
  },
} satisfies OperationBinding<typeof operation>
