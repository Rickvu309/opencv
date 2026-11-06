import {
  DEFAULT_COACH_MODELS,
  type ApplyScanExtractInput,
  type ChatToolName,
  type CoachRuntime,
  type CoachStreamPart,
  type CoachTurnInput,
} from "@workspace/domain"

import { createRequestStepBoundary, scriptedSteps } from "./model-step.js"
import { toolResultFromExecute } from "./receipt.js"

export const DEMO_COACH_SCRIPT: CoachStreamPart[] = [
  { type: "text-delta", text: "I looked at Apply. " },
  {
    type: "tool-call",
    toolCallId: "call_1",
    name: "job.list",
    input: {},
  },
  {
    type: "tool-result",
    toolCallId: "call_1",
    name: "job.list",
    summary: "Listed your Apply cards",
    ok: true,
    reversal: {
      possible: false,
      description: "Listing cards does not change anything.",
    },
    result: { ok: true, data: [] },
  },
  { type: "text-delta", text: "Prep the starred one next." },
  {
    type: "finish",
    finishReason: "stop",
    usage: {
      model: DEFAULT_COACH_MODELS.free,
      tokens: 42,
      costEstimate: "0.001",
      finishReason: "stop",
    },
  },
]

export function createScriptedCoachRuntime(
  script:
    | readonly CoachStreamPart[]
    | ((input: CoachTurnInput) => AsyncIterable<CoachStreamPart>)
): CoachRuntime {
  return {
    streamTurn(input) {
      const boundary = createRequestStepBoundary()
      const execute = input.execute
      const completed = new Set<string>()
      const pending = new Map<
        string,
        { id: string; name: ChatToolName; input: unknown }
      >()
      const wrap = async function* (parts: AsyncIterable<CoachStreamPart>) {
        for await (const part of scriptedSteps(parts, boundary)) {
          if (part.type === "tool-call")
            pending.set(part.name, {
              id: part.toolCallId,
              name: part.name,
              input: part.input,
            })
          if (part.type === "tool-result" && !completed.has(part.toolCallId)) {
            const saved = pending.get(part.name)
            const intent =
              saved?.id === part.toolCallId
                ? saved
                : { id: part.toolCallId, name: part.name, input: {} }
            if (saved?.id !== part.toolCallId)
              await boundary.persistStep({
                index: 0,
                intents: [intent],
                stopReason: "tool_use",
              })
            await boundary.runIntent(intent, async () => part)
            completed.add(part.toolCallId)
          }
          yield part
        }
      }
      input = {
        ...input,
        execute: execute
          ? (call) => {
              const intent = pending.get(call.name)
              if (!intent) throw new Error("Missing scripted decision")
              return boundary.runIntent(
                { ...intent, input: call.input },
                async () => {
                  const result = await execute(call)
                  completed.add(intent.id)
                  return result
                }
              )
            }
          : undefined,
      }
      if (typeof script === "function") {
        return overlayTurnModel(wrap(script(input)), input)
      }
      return overlayTurnModel(wrap(replay(script)), input)
    },
  }
}

async function* overlayTurnModel(
  parts: AsyncIterable<CoachStreamPart>,
  input: CoachTurnInput
): AsyncGenerator<CoachStreamPart> {
  for await (const part of parts) {
    if (part.type === "finish" && input.model) {
      yield {
        ...part,
        usage: {
          ...part.usage,
          model: input.model,
          mode: input.mode ?? part.usage.mode,
        },
      }
      continue
    }
    yield part
  }
}

function paperEditScript(
  input: CoachTurnInput
): AsyncIterable<CoachStreamPart> {
  const focus = input.focusDoc
  const execute = input.execute
  if (!focus || !execute) return replay(DEMO_COACH_SCRIPT)
  const rest = focus.outline.split("\n").slice(1).join("\n")
  const first = /^\[([A-Za-z0-9_-]+)\]/m.exec(rest)
  const edit = {
    op: "insert",
    after: first?.[1] ?? "@start",
    blocks: [{ type: "paragraph", text: "Reviewed by the Coach." }],
  }
  const call = {
    docId: focus.id,
    basedOn: focus.revision,
    edits: [edit],
  }
  return (async function* () {
    yield { type: "text-delta", text: "I made one edit. " } as const
    yield {
      type: "tool-call",
      toolCallId: "call_edit",
      name: "paper.edit",
      input: call,
    } as const
    const result = await execute({ name: "paper.edit", input: call })
    yield toolResultFromExecute({
      toolCallId: "call_edit",
      name: "paper.edit",
      summary: "Edit the document",
      result,
    })
    yield {
      type: "finish",
      finishReason: "stop",
      usage: {
        model: DEFAULT_COACH_MODELS.free,
        tokens: 42,
        costEstimate: "0.001",
        finishReason: "stop",
      },
    } as const
  })()
}

export function createDemoCoachRuntime(): CoachRuntime {
  return createScriptedCoachRuntime(paperEditScript)
}

export function withScanJobPosting(
  runtime: CoachRuntime,
  scanJobPosting: (input: ApplyScanExtractInput) => Promise<string>
): CoachRuntime {
  return { ...runtime, scanJobPosting }
}

async function* replay(
  script: readonly CoachStreamPart[]
): AsyncGenerator<CoachStreamPart> {
  for (const part of script) {
    yield part
  }
}
