import type { ChatEntryPart } from "@workspace/domain"

import type { Registry } from "../registry/registry.js"
import { withMissingReceipts } from "./receipt.js"

export { insertCoachMessage, trackChatTurn } from "./chat/index.js"
export {
  finishCoachUsage,
  openCoachUsage,
  saveRepliesForUnsavedTurns,
} from "./usage-store.js"

type ExecuteOptions = Parameters<Registry["execute"]>[0]

export type TurnEffects = {
  registry: Pick<Registry, "read" | "execute">
  execute: Registry["execute"]
  settleTools(): Promise<void>
  recordMissingReceipts(parts: ChatEntryPart[]): Promise<ChatEntryPart[]>
}

export function createTurnEffects(
  registry: Registry,
  turn: { userId: string; turnId: string }
): TurnEffects {
  const inflight = new Set<Promise<unknown>>()
  const execute: Registry["execute"] = (options: ExecuteOptions) => {
    const run = registry.execute(options)
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
    async recordMissingReceipts(parts) {
      return withMissingReceipts(
        parts,
        await registry.turnReceipts(turn.userId, [turn.turnId])
      )
    },
  }
}
