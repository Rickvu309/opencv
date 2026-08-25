import {
  ERROR_CODES,
  errorEnvelope,
  type CoachStreamPart,
  type CommandEnvelope,
  type ReversalDescriptor,
} from "@workspace/domain"

import { envelopeFromToolOutput, summarizeToolResult } from "./receipts.js"

export type ModelUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
}

export type ModelStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; name: string; input: unknown }
  | { type: "tool-result"; toolCallId: string; name: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; name: string; error: unknown }
  | { type: "finish"; finishReason: string; usage: ModelUsage }
  | { type: "error"; message: string }
  | { type: "abort" }

export type TranslateStreamOptions = {
  model: string
  startedAt: number
  reversalFor: (name: string) => ReversalDescriptor | undefined
}

export function tokensFromUsage(usage: ModelUsage): number | undefined {
  if (usage.totalTokens != null) return usage.totalTokens
  if (usage.inputTokens != null || usage.outputTokens != null) {
    return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  }
  return undefined
}

/**
 * Provider cost when present; otherwise a coarse Claude-class estimate
 * ($3/M input, $15/M output) so the usage row still has a number.
 */
export function estimateCostUsd(usage: ModelUsage): string | undefined {
  if (typeof usage.cost === "number" && Number.isFinite(usage.cost)) {
    return usage.cost.toFixed(6)
  }
  const input = usage.inputTokens ?? 0
  const output =
    usage.outputTokens ??
    (usage.totalTokens != null ? Math.max(0, usage.totalTokens - input) : 0)
  if (input === 0 && output === 0) return undefined
  return ((input * 3 + output * 15) / 1_000_000).toFixed(6)
}

export async function* partsFromModelStream(
  events: AsyncIterable<ModelStreamEvent>,
  options: TranslateStreamOptions
): AsyncGenerator<CoachStreamPart> {
  for await (const event of events) {
    switch (event.type) {
      case "text-delta":
        if (event.text) {
          yield { type: "text-delta", text: event.text }
        }
        break
      case "tool-call":
        yield {
          type: "tool-call",
          toolCallId: event.toolCallId,
          name: event.name,
          input: event.input,
        }
        break
      case "tool-result":
        yield toolResultPart(event.name, event.toolCallId, event.output, options)
        break
      case "tool-error":
        yield toolResultPart(
          event.name,
          event.toolCallId,
          errorFromUnknown(event.error),
          options
        )
        break
      case "finish":
        yield finishPart(event.finishReason, event.usage, options)
        return
      case "error":
        yield { type: "error", message: event.message }
        return
      case "abort":
        yield finishPart("aborted", {}, options)
        return
    }
  }
}

function toolResultPart(
  name: string,
  toolCallId: string,
  output: unknown,
  options: TranslateStreamOptions
): CoachStreamPart {
  const result = envelopeFromToolOutput(output)
  const reversal = result.ok ? options.reversalFor(name) : undefined
  return {
    type: "tool-result",
    toolCallId,
    name,
    summary: summarizeToolResult(name, result),
    ok: result.ok,
    ...(reversal ? { reversal } : {}),
    result,
  }
}

function finishPart(
  finishReason: string,
  usage: ModelUsage,
  options: TranslateStreamOptions
): CoachStreamPart {
  const latencyMs = Math.max(0, Date.now() - options.startedAt)
  return {
    type: "finish",
    finishReason,
    usage: {
      model: options.model,
      tokens: tokensFromUsage(usage),
      costEstimate: estimateCostUsd(usage),
      latencyMs,
      finishReason,
    },
  }
}

function errorFromUnknown(error: unknown): CommandEnvelope {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Tool failed"
  return errorEnvelope(ERROR_CODES.VALIDATION_ERROR, message)
}
