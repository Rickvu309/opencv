import {
  appendCoachPart,
  textFromParts,
  type CoachRuntime,
  type CoachTurnInput,
} from "@workspace/domain"

import type { EvalTranscript, RecordedToolCall, RecordedToolResult } from "./types.js"

export async function collectTranscript(
  runtime: CoachRuntime,
  input: CoachTurnInput
): Promise<EvalTranscript> {
  const toolCalls: RecordedToolCall[] = []
  const toolResults: RecordedToolResult[] = []
  let parts: EvalTranscript["parts"] = []
  let finishReason: string | undefined
  let usage: EvalTranscript["usage"]
  let error: string | undefined

  for await (const part of runtime.streamTurn(input)) {
    parts = appendCoachPart(parts, part)
    if (part.type === "tool-call") {
      toolCalls.push({
        toolCallId: part.toolCallId,
        name: part.name,
        input: part.input,
      })
    }
    if (part.type === "tool-result") {
      toolResults.push({
        toolCallId: part.toolCallId,
        name: part.name,
        ok: part.ok,
        summary: part.summary,
      })
    }
    if (part.type === "finish") {
      finishReason = part.finishReason
      usage = part.usage
    }
    if (part.type === "error") {
      error = part.message
    }
  }

  return {
    text: textFromParts(parts),
    parts,
    toolCalls,
    toolResults,
    finishReason,
    usage,
    error,
  }
}
