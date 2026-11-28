import { operation } from "@workspace/domain/operations/paper/save"
import type { OperationBinding } from "../../../registry/bind.js"
import { saveEngineChanges } from "./engine.js"

export const implementation = {
  operation,
  execute: (input, actor) => saveEngineChanges(input, actor),
  reversal: { irreversible: "Typing is taken back in the editor itself." },
  activity: { silent: "Typing writes no receipt." },
} satisfies OperationBinding<typeof operation>
