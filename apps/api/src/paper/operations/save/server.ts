import { ERROR_CODES } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/paper/save"
import { CommandError } from "../../../platform/errors.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { saveEngineChanges } from "./engine.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    if ("changes" in input) return saveEngineChanges(input, actor)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This Paper uses the new change log"
    )
  },
  reversal: { irreversible: "Typing is taken back in the editor itself." },
  activity: { silent: "Typing writes no receipt." },
} satisfies OperationBinding<typeof operation>
