import { operation } from "@workspace/domain/operations/paper/export"
import type { OperationBinding } from "../../../registry/bind.js"
import { exportWordPackage } from "../../package-store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
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
