import { operation } from "@workspace/domain/operations/paper/export"
import type { OperationBinding } from "../../../registry/bind.js"
import { withRichSnapshot } from "../../content/content-store.js"
import { exportWordPackage } from "../../word-package/package-store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if (!("at" in input))
      return withRichSnapshot(actor.userId, input, async (snapshot) => ({
        docId: snapshot.docId,
        kind: snapshot.kind,
        name: snapshot.name,
        basis: snapshot.basis,
      }))
    const { metadata } = await exportWordPackage(
      actor.userId,
      input.docId,
      input.at
    )
    return {
      ...metadata,
      downloadPath: `/api/paper/packages/${metadata.docId}/export?at=${metadata.revision}`,
    }
  },
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof operation.publicResult>
>
