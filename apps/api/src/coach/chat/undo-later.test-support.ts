import { idOf, text } from "../../registry/coverage-helpers.test-support.js"
import type { ExecuteResult } from "../../registry/registry.js"
import type {
  LaterCases,
  LaterWorld,
} from "../../registry/undo-later.test-support.js"

async function chatField(world: LaterWorld, a: ExecuteResult, field: string) {
  return text(await world.read("chat.get", { chatId: idOf(a.output) }), field)
}

const focused: { docId?: string } = {}

export const chatUndoLater: LaterCases = {
  "chat.rename": {
    act: async (a, { run }) => {
      await run("chat.rename", { chatId: idOf(a.output), title: "Later title" })
    },
    survives: async (a, world) =>
      (await chatField(world, a, "title")) === "Later title",
  },
  "chat.setFocus": {
    act: async (a, { run }) => {
      const docId = idOf(
        (await run("paper.create", { kind: "cv", name: "Later focus" })).output
      )
      await run("chat.setFocus", {
        chatId: idOf(a.output),
        focus: { kind: "paper", id: docId },
      })
      focused.docId = docId
    },
    survives: async (a, world) =>
      (await chatField(world, a, "focusId")) === focused.docId,
  },
}
