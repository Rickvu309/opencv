import {
  DEFAULT_COACH_MODEL,
  type CoachRuntime,
  type CoachStreamPart,
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
      model: DEFAULT_COACH_MODEL,
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
        return script(input)
      }
      return replay(script)
    },
  }
}

export function createDemoCoachRuntime(): CoachRuntime {
  return createScriptedCoachRuntime(DEMO_COACH_SCRIPT)
}

export function createThrowingCoachRuntime(
  error: Error = new Error("runtime failed")
): CoachRuntime {
  return {
    async *streamTurn() {
      throw error
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
