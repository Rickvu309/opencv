import {
  DEFAULT_COACH_MODELS,
  type CoachFocusDoc,
  type ApplyScanExtractInput,
  type ChatToolName,
  type CoachRuntime,
  type CoachStreamPart,
  type CoachTurnInput,
} from "@workspace/domain/coach"
import { catalog } from "@workspace/domain/kernel"
import {
  RICH_NATIVE_WRITER,
  nativeBasisSchema,
} from "@workspace/domain/paper-doc"

import {
  createRequestStepBoundary,
  scriptedSteps,
  type WorkerRuntime,
} from "./model-step.js"
import { toolResultFromExecute } from "./receipt.js"

export const FAKE_PROPOSED_EDIT_TEXT = "I proposed one edit."

export const DEMO_COACH_SCRIPT: CoachStreamPart[] = [
  { type: "text-delta", text: "I looked at Apply. " },
  {
    type: "tool-call",
    toolCallId: "call_1",
    name: catalog["job.list"].name,
    input: {},
  },
  {
    type: "tool-result",
    toolCallId: "call_1",
    name: catalog["job.list"].name,
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

const FAKE_COACH_WORDS = "Reviewed by the Coach."

function fakeRichEdits(outline: string) {
  const nodes = JSON.parse(outline) as { id: string }[]
  const first = nodes[0]
  if (!first) throw new Error("A rich Paper proposal needs a text block")
  return [
    {
      op: "replaceText",
      blockId: first.id,
      from: 0,
      to: 0,
      before: "",
      text: `${FAKE_COACH_WORDS} `,
    },
  ]
}

function fakeEngineCommands(outline: string) {
  const blocks = JSON.parse(outline) as { id: string; text?: string }[]
  const first = blocks.find((block) => typeof block.text === "string")
  if (!first) throw new Error("A Paper proposal needs a text block")
  const at = { block: first.id, offset: 0 }
  return [
    {
      op: "replaceText",
      range: { from: at, to: at },
      expect: "",
      text: `${FAKE_COACH_WORDS} `,
    },
  ]
}

export function fakePaperEdit(
  focus: Pick<
    CoachFocusDoc,
    "id" | "revision" | "outline" | "nativeBasis" | "engine"
  >
) {
  if (focus.engine === 2)
    return catalog["paper.edit"].input.parse({
      docId: focus.id,
      basedOn: focus.revision,
      commands: fakeEngineCommands(focus.outline),
    })
  if (focus.nativeBasis && focus.nativeBasis.revision !== focus.revision)
    throw new Error("Native Paper proposal needs a matching outline")
  return catalog["paper.edit"].input.parse({
    docId: focus.id,
    basedOn: focus.revision,
    ...(focus.nativeBasis
      ? {
          writer: RICH_NATIVE_WRITER,
          nativeBasis: nativeBasisSchema.parse(focus.nativeBasis),
        }
      : {}),
    edits: fakeRichEdits(focus.outline),
  })
}

function paperEditScript(
  input: CoachTurnInput
): AsyncIterable<CoachStreamPart> {
  const focus = input.focusDoc
  const execute = input.execute
  if (!focus || !execute) return replay(DEMO_COACH_SCRIPT)
  const call = fakePaperEdit(focus)
  return (async function* () {
    yield { type: "text-delta", text: `${FAKE_PROPOSED_EDIT_TEXT} ` } as const
    yield {
      type: "tool-call",
      toolCallId: "call_edit",
      name: catalog["paper.edit"].name,
      input: call,
    } as const
    const result = await execute({
      name: catalog["paper.edit"].name,
      input: call,
    })
    yield toolResultFromExecute({
      toolCallId: "call_edit",
      name: catalog["paper.edit"].name,
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

export function createScriptedWorkerRuntime(
  script: readonly {
    text: string
    intents: readonly { id: string; name: ChatToolName; input: unknown }[]
    inputTokens: number
    outputTokens: number
  }[]
): WorkerRuntime {
  return async function* (input) {
    const start = input.completedSteps
    for (const [index, decision] of script
      .slice(start, start + input.maxSteps)
      .entries()) {
      input.signal.throwIfAborted()
      if (decision.text) yield { type: "text-delta", text: decision.text }
      await input.boundary.persistStep({
        index,
        intents: decision.intents,
        stopReason: decision.intents.length ? "tool_use" : "end_turn",
        usage: {
          inputTokens: decision.inputTokens,
          outputTokens: decision.outputTokens,
        },
        message: {
          role: "assistant",
          content: [
            { type: "text", text: decision.text },
            ...decision.intents.map((intent) => ({
              type: "tool_use" as const,
              id: intent.id,
              name: intent.name.replaceAll(".", "_"),
              input: intent.input,
            })),
          ],
        },
      })
      for (const intent of decision.intents)
        await input.boundary.runIntent(intent, async () => {
          throw new Error("Scripted worker attempted an unsaved effect")
        })
      if (!decision.intents.length) return
    }
  }
}
