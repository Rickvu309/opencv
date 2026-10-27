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

export function createDemoCoachRuntime(): CoachRuntime {
  return createScriptedCoachRuntime(DEMO_COACH_SCRIPT)
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
