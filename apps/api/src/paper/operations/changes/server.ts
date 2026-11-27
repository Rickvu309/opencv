import { parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/changes"
import type { OperationBinding } from "../../../registry/bind.js"
import { changesSince } from "../../engine-sync-log.js"

export const implementation = {
  operation,
  async execute({ docId, since }, actor) {
    const batch = await changesSince(actor.userId, parsePaperId(docId), since)
    if ("compacted" in batch)
      return { head: batch.compacted.head, compacted: true }
    return batch
  },
} satisfies OperationBinding<typeof operation>
