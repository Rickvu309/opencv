import type {
  CoachTurnUsage,
  ThreadMessagePart,
} from "@workspace/domain"

export const HONESTY_CHECK_IDS = [
  "no-exclamation-marks",
  "no-claimed-action-without-receipt",
  "exactly-one-next-step",
  "tool-calls-valid",
] as const

export type HonestyCheckId = (typeof HONESTY_CHECK_IDS)[number]

export type HonestyCheckResult = {
  id: string
  label: string
  pass: boolean
  detail: string
}

export type RecordedToolCall = {
  toolCallId: string
  name: string
  input: unknown
}

export type RecordedToolResult = {
  toolCallId: string
  name: string
  ok: boolean
  summary: string
}

export type EvalTranscript = {
  text: string
  parts: ThreadMessagePart[]
  toolCalls: RecordedToolCall[]
  toolResults: RecordedToolResult[]
  finishReason?: string
  usage?: CoachTurnUsage
  error?: string
}

export type ScenarioExpectation = {
  /** A successful receipt for this tool must be present. */
  requireSuccessfulTool?: string
  /** Successful mutation receipts are a fail (reads are fine). */
  forbidSuccessfulMutation?: boolean
}

export type SeedPaperDoc = {
  name: string
  content: Record<string, unknown>
}

export type SeedApplyCard = {
  title: string
  company: string
  note?: string
  stage?: "inbox" | "prep" | "sent" | "live" | "closed"
  starred?: boolean
  jobUrl?: string | null
}

export type ScenarioSeed = {
  profileName: string
  paper: SeedPaperDoc[]
  apply: SeedApplyCard[]
}

export type GoldenScenario = {
  id: string
  title: string
  description: string
  userMessage: string
  seed: ScenarioSeed
  expect: ScenarioExpectation
  /** Extra judge instructions for this scenario. */
  judgeFocus: string
}

export type PersonaRubricScores = {
  evidenceOverEncouragement: number
  oneNextStep: number
  calmVoice: number
  honestAboutDistance: number
  actionHonesty: number
}

export type JudgeVerdict = {
  scores: PersonaRubricScores
  overall: number
  rationale: string
}

export type ScenarioEvalResult = {
  scenario: GoldenScenario
  transcript: EvalTranscript
  honesty: HonestyCheckResult[]
  judge?: JudgeVerdict
  judgeError?: string
}

export type EvalReport = {
  generatedAt: string
  coachModel: string
  judgeModel: string
  results: ScenarioEvalResult[]
}
