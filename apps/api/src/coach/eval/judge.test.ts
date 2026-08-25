import { describe, expect, it, vi } from "vitest"

import {
  buildJudgePrompt,
  DEFAULT_EVAL_JUDGE_MODEL,
  judgeModelFromEnv,
  judgeTranscript,
} from "./judge.js"
import { GOLDEN_SCENARIOS } from "./scenarios.js"
import type { EvalTranscript } from "./types.js"

const scenario = GOLDEN_SCENARIOS[0]!

const transcript: EvalTranscript = {
  text: "The CV has no experience. Next step: write one Proof from last semester.",
  parts: [],
  toolCalls: [],
  toolResults: [],
}

describe("judgeModelFromEnv", () => {
  it("defaults to a cheap OpenRouter model", () => {
    expect(judgeModelFromEnv({})).toBe(DEFAULT_EVAL_JUDGE_MODEL)
    expect(judgeModelFromEnv({ COACH_EVAL_JUDGE_MODEL: "  google/gemini-2.5-flash-lite  " })).toBe(
      "google/gemini-2.5-flash-lite"
    )
  })
})

describe("buildJudgePrompt", () => {
  it("includes the rubric, scenario focus, and transcript", () => {
    const prompt = buildJudgePrompt(scenario, {
      ...transcript,
      toolResults: [
        {
          toolCallId: "c1",
          name: "paper_getDoc",
          ok: true,
          summary: "Read Internship CV",
        },
      ],
    })
    expect(prompt).toMatch(/evidenceOverEncouragement/)
    expect(prompt).toContain(scenario.judgeFocus)
    expect(prompt).toContain(scenario.userMessage)
    expect(prompt).toContain("paper_getDoc ok")
    expect(prompt).not.toMatch(/!/)
  })
})

describe("judgeTranscript", () => {
  it("parses a rubric score with rationale from OpenRouter HTTP", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  scores: {
                    evidenceOverEncouragement: 4,
                    oneNextStep: 5,
                    calmVoice: 5,
                    honestAboutDistance: 4,
                    actionHonesty: 5,
                  },
                  overall: 4,
                  rationale: "Cited the empty CV and gave one Proof step.",
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    })

    const verdict = await judgeTranscript(
      "sk-or-test",
      DEFAULT_EVAL_JUDGE_MODEL,
      scenario,
      transcript,
      fetchImpl as unknown as typeof fetch
    )

    expect(verdict.overall).toBe(4)
    expect(verdict.rationale).toMatch(/empty CV/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer sk-or-test")
  })
})
