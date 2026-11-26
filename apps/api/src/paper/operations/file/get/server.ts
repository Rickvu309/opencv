import { parseFileId } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/file/get"
import type { OperationBinding } from "../../../../registry/bind.js"
import { readFileMeta } from "../../../store.js"

export const implementation = {
  operation,
  execute: (input, actor) =>
    readFileMeta(actor.userId, parseFileId(input.fileId)),
} satisfies OperationBinding<typeof operation>
