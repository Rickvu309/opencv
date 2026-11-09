import { operation } from "@workspace/domain/operations/paper/read"
import { ERROR_CODES } from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { CommandError } from "../../../registry/errors.js"
import { listWordPackages, readWordPackage } from "../../package-store.js"

export const implementation = {
  operation,
  execute: (input, actor) => {
    if (process.env.PAPER_PACKAGE_ENABLED !== "true")
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "Saved Word documents are unavailable."
      )
    return "view" in input
      ? listWordPackages(actor.userId, input.after)
      : readWordPackage(actor.userId, input)
  },
} satisfies OperationBinding<
  typeof operation,
  | Awaited<ReturnType<typeof listWordPackages>>
  | Awaited<ReturnType<typeof readWordPackage>>
>
