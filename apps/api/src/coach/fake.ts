import {
  DEFAULT_COACH_MODELS,
  type ApplyScanExtractInput,
  type CoachRuntime,
  type CoachStreamPart,
  type CoachTitleInput,
  type CoachTurnInput,
} from "@workspace/domain"

export const DEMO_COACH_SCRIPT: CoachStreamPart[] = [
  { type: "text-delta", text: "I looked at Apply. " },
  {
    type: "tool-call",
    toolCallId: "call_1",
    name: "apply_listCards",
    input: {},
  },
  {
    type: "tool-result",
    toolCallId: "call_1",
    name: "apply_listCards",
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
      if (typeof script === "function") {
        return overlayTurnModel(script(input), input)
      }
      return overlayTurnModel(replay(script), input)
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

export const HOLD_MS = 3000

const FAIL_TEXT = "database password leaked at /tmp/secret"

function latestPersonText(input: CoachTurnInput) {
  return (
    [...input.history].reverse().find((message) => message.role !== "coach")
      ?.text ?? ""
  )
}

function finishPart(): CoachStreamPart {
  return {
    type: "finish",
    finishReason: "stop",
    usage: {
      model: DEFAULT_COACH_MODELS.free,
      tokens: 42,
      costEstimate: "0.001",
      finishReason: "stop",
    },
  }
}

async function* demoParts(
  input: CoachTurnInput
): AsyncGenerator<CoachStreamPart> {
  const text = latestPersonText(input).toLowerCase()
  if (text.includes("fail")) throw new Error(FAIL_TEXT)
  if (text.includes("hold")) {
    yield {
      type: "tool-call",
      toolCallId: "call_hold",
      name: "job.list",
      input: {},
    }
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS))
    yield { type: "text-delta", text: "I looked at Apply. " }
    yield { type: "text-delta", text: "Prep the starred one next." }
    yield finishPart()
    return
  }
  if (text.includes("confirm")) {
    yield {
      type: "tool-call",
      toolCallId: "call_confirm",
      name: "coach.confirm",
      input: {},
    }
    return
  }
  yield* replay(DEMO_COACH_SCRIPT)
}

export function createDemoCoachRuntime(): CoachRuntime {
  return createScriptedCoachRuntime(demoParts)
}

export function withTitleGenerator(
  runtime: CoachRuntime,
  generateTitle: (input: CoachTitleInput) => Promise<string>
): CoachRuntime {
  return { ...runtime, generateTitle }
}

export function withScanJobPosting(
  runtime: CoachRuntime,
  scanJobPosting: (input: ApplyScanExtractInput) => Promise<string>
): CoachRuntime {
  return { ...runtime, scanJobPosting }
}

export function createThrowingCoachRuntime(
  error: Error = new Error("runtime failed")
): CoachRuntime {
  return {
    streamTurn() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(error)
            },
          }
        },
      }
    },
  }
}

async function* replay(
  script: readonly CoachStreamPart[]
): AsyncGenerator<CoachStreamPart> {
  for (const part of script) {
    yield part
  }
}
