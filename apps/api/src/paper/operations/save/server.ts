import { ERROR_CODES, parsePaperId } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/save"
import { CommandError } from "../../../platform/errors.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { syncContent } from "../../content/content-store.js"

import { lockOwnedPaper } from "../../engine-sync-log.js"
import { NEW_ENGINE } from "../../log/index.js"
import { saveEngineChanges } from "./engine.js"

function bytesOf(encoded: string) {
  return new Uint8Array(Buffer.from(encoded, "base64"))
}

function encoded(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64")
}

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if ("changes" in input) return saveEngineChanges(input, actor)

    const docId = parsePaperId(input.docId)
    const { engine } = await lockOwnedPaper(actor.userId, docId, "update")
    if (engine === NEW_ENGINE)
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "This Paper uses the new change log"
      )

    const reply = await syncContent(actor.userId, docId, {
      writer: input.writer,
      provenance: input.provenance,
      epoch: input.epoch,
      update: bytesOf(input.update),
      stateVector: bytesOf(input.stateVector),
      basedOn: input.basedOn,
    })
    if (!reply.provenance)
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "Native provenance required"
      )
    return {
      provenance: reply.provenance,
      epoch: reply.epoch,
      revision: reply.revision,
      reset: reply.reset,
      stale: reply.stale,
      update: encoded(reply.update),
      stateVector: encoded(reply.stateVector),
    }
  },
  reversal: { irreversible: "Typing is taken back in the editor itself." },
  activity: { silent: "Typing writes no receipt." },
} satisfies OperationBinding<typeof operation>
