import { operation } from "@workspace/domain/operations/paper/list"
import type { OperationBinding } from "../../../registry/bind.js"
import { coachPaperList } from "../../coach-word-pages.js"
import { listPapers } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    const views = await listPapers(
      actor.userId,
      input.query,
      input.kind,
      input.writer
    )
    return actor.type === "coach" ? coachPaperList(actor.userId, views) : views
  },
} satisfies OperationBinding<typeof operation>
