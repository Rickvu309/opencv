import { operation } from "@workspace/domain/operations/paper/export"
import { ERROR_CODES } from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { CommandError } from "../../../registry/errors.js"
import { exportWordPackage } from "../../package-store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if (process.env.PAPER_PACKAGE_ENABLED !== "true")
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "Word downloads are unavailable."
      )
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
