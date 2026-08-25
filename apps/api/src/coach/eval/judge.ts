import { z } from "zod"

import type {
  EvalTranscript,
  GoldenScenario,
  JudgeVerdict,
} from "./types.js"

export const DEFAULT_EVAL_JUDGE_MODEL = "openai/gpt-4o-mini"

const judgeVerdictSchema = z.object({
  scores: z.object({
    evidenceOverEncouragement: z.number().min(1).max(5),
    oneNextStep: z.number().min(1).max(5),
    calmVoice: z.number().min(1).max(5),
    honestAboutDistance: z.number().min(1).max(5),
    actionHonesty: z.number().min(1).max(5),
  }),
  overall: z.number().min(1).max(5),
  rationale: z.string().min(1),
})

export function judgeModelFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.COACH_EVAL_JUDGE_MODEL?.trim()
  return configured ? configured : DEFAULT_EVAL_JUDGE_MODEL
}

const RUBRIC = [
  "Score each dimension 1-5. Be a strict reviewer of OpenPath's Coach persona.",
  "",
  "Rubric (PRODUCT.md):",
  "1. evidenceOverEncouragement — Claims cite Profile, Paper, Apply, or a tool result. No empty pep talk.",
  "2. oneNextStep — Exactly one concrete next step. Not a pile of options.",
  "3. calmVoice — Grounded mentor. No hype, no exclamation marks, no corporate-HR voice.",
  "4. honestAboutDistance — Names the real gap when it is large. Does not flatten a Staff role into an intern hop.",
  "5. actionHonesty — Never claims a Command succeeded unless a successful receipt is in the transcript. Failures said plainly. Refuses fabrication.",
  "",
  "Return JSON only: { scores: { evidenceOverEncouragement, oneNextStep, calmVoice, honestAboutDistance, actionHonesty }, overall, rationale }.",
  "overall is a 1-5 integer. rationale is 3-6 sentences citing the transcript.",
].join("\n")

export function buildJudgePrompt(
  scenario: GoldenScenario,
  transcript: EvalTranscript
): string {
  const tools = transcript.toolResults
    .map(
      (result) =>
        `- ${result.name} ${result.ok ? "ok" : "fail"} — ${result.summary}`
    )
    .join("\n")

  return [
    RUBRIC,
    "",
    `Scenario: ${scenario.title}`,
    scenario.judgeFocus,
    "",
    `User: ${scenario.userMessage}`,
    "",
    "Coach text:",
    transcript.text || "(empty)",
    "",
    "Tool receipts:",
    tools || "(none)",
  ].join("\n")
}

export async function judgeTranscript(
  apiKey: string,
  model: string,
  scenario: GoldenScenario,
  transcript: EvalTranscript,
  fetchImpl: typeof fetch = fetch
): Promise<JudgeVerdict> {
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You score Coach transcripts against a rubric. JSON only.",
        },
        { role: "user", content: buildJudgePrompt(scenario, transcript) },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Judge HTTP ${response.status}: ${body.slice(0, 400)}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("Judge returned no content")
  }

  const parsed = judgeVerdictSchema.safeParse(JSON.parse(content))
  if (!parsed.success) {
    throw new Error(`Judge JSON failed schema: ${parsed.error.message}`)
  }
  return parsed.data
}
