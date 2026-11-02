import {
  appendCoachPart,
  chatToolNameSchema,
  type ChatEntryPart,
  type CoachStreamPart,
} from "@workspace/domain"

import type { ExecuteResult, Registry } from "../registry/registry.js"
import { toolResultFromExecute } from "./receipt.js"

export { insertCoachMessage, trackChatTurn } from "../chat/index.js"
export { finishCoachUsage, openCoachUsage } from "./usage-store.js"

type ExecuteOptions = Parameters<Registry["execute"]>[0]

type Executed = { name: string; result: ExecuteResult }

export type TurnEffects = {
  registry: Pick<Registry, "read" | "execute">
  execute: Registry["execute"]
  settleTools(): Promise<void>
  recordMissingReceipts(parts: ChatEntryPart[]): ChatEntryPart[]
}

export function createTurnEffects(registry: Registry): TurnEffects {
  const inflight = new Set<Promise<unknown>>()
  const executed: Executed[] = []
  const execute: Registry["execute"] = (options: ExecuteOptions) => {
    const run = registry.execute(options).then((result) => {
      executed.push({ name: options.name, result })
      return result
    })
    inflight.add(run)
    const forget = () => {
      inflight.delete(run)
    }
    run.then(forget, forget)
    return run
  }
  return {
    registry: { read: registry.read.bind(registry), execute },
    execute,
    async settleTools() {
      while (inflight.size > 0) await Promise.allSettled([...inflight])
    },
    recordMissingReceipts(parts) {
      const recorded = new Set(
        parts.flatMap((part) =>
          part.type === "tool"
            ? [part.activityId, part.pendingActionId].filter(Boolean)
            : []
        )
      )
      return executed.reduce<ChatEntryPart[]>((all, { name, result }) => {
        const key = result.activityId ?? result.pendingActionId
        const tool = chatToolNameSchema.safeParse(name)
        if (!key || !tool.success || recorded.has(key)) return all
        recorded.add(key)
        const receipt: CoachStreamPart = toolResultFromExecute({
          toolCallId: `receipt-${key}`,
          name: tool.data,
          summary: result.summary || name,
          result,
        })
        return appendCoachPart(all, receipt)
      }, parts)
    },
  }
}
