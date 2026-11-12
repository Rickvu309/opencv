import { operation } from "@workspace/domain/operations/paper/read"
import { ERROR_CODES } from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { CommandError } from "../../../registry/errors.js"
import { packageFailure } from "../../package-pages.js"
import { listWordPackages, readWordPackage } from "../../package-store.js"
import { open } from "../../word/document.js"

async function readWordLines(owner: string, doc: string, at?: string) {
  const page = await open(
    owner,
    at ? { kind: "read", doc, at } : { kind: "read", doc }
  )
  return "refused" in page ? packageFailure(page.message) : page
}

export const implementation = {
  operation,
  execute: (input, actor) => {
    if (process.env.PAPER_PACKAGE_ENABLED !== "true")
      throw new CommandError(
        ERROR_CODES.NOT_FOUND,
        "Saved Word documents are unavailable."
      )
    if (!("view" in input)) return readWordPackage(actor.userId, input)
    return input.view === "page"
      ? readWordLines(actor.userId, input.docId, input.at)
      : listWordPackages(actor.userId, input.after)
  },
} satisfies OperationBinding<
  typeof operation,
  | Awaited<ReturnType<typeof listWordPackages>>
  | Awaited<ReturnType<typeof readWordPackage>>
  | Awaited<ReturnType<typeof readWordLines>>
>
