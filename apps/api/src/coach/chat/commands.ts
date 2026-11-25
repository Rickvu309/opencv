import { tableQuery } from "../../registry/bind.js"
import { hostDelegateProposals } from "../../registry/proposal-hosts.js"
import type { Registry } from "../../registry/registry.js"
import {
  appendAgentProposalApproval,
  createAgentProposalChat,
} from "./agent-proposal.js"

const stops = new Map<string, Set<AbortController>>()

export function stopChat(chatId: string) {
  const controllers = stops.get(chatId)
  if (!controllers) return false
  for (const controller of controllers) controller.abort()
  stops.delete(chatId)
  return true
}

export function trackChatTurn(chatId: string, controller: AbortController) {
  const controllers = stops.get(chatId) ?? new Set<AbortController>()
  controllers.add(controller)
  stops.set(chatId, controllers)
  return () => {
    controllers.delete(controller)
    if (controllers.size === 0) stops.delete(chatId)
  }
}

export function registerChat(registry: Registry) {
  hostDelegateProposals({
    open: createAgentProposalChat,
    show: appendAgentProposalApproval,
  })

  registry.addQuery(
    tableQuery("link.get", {
      description: "Read a link host. The page is not fetched.",
      coach: true,
      step: () => "Read the link",
      read: async (input) => {
        let host: string
        try {
          host = new URL(input.url).host
        } catch {
          host = ""
        }
        return { url: input.url, host }
      },
    })
  )
}
