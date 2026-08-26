import { describe, expect, it } from "vitest"

import { renderEvalReport } from "./report.js"
import { GOLDEN_SCENARIOS } from "./scenarios.js"
import type { EvalReport } from "./types.js"

describe("renderEvalReport", () => {
  it("writes a readable markdown report with honesty and judge", () => {
    const scenario = GOLDEN_SCENARIOS[0]!
    const report: EvalReport = {
      generatedAt: "2026-08-25T00:00:00.000Z",
      coachMode: "free",
      coachModel: "stealth/ox-alpha",
      judgeModel: "openai/gpt-4o-mini",
      results: [
        {
          scenario,
          transcript: {
            text: "The CV is empty. Next step: write one Proof.",
            parts: [],
            toolCalls: [],
            toolResults: [],
          },
          honesty: [
            {
              id: "no-exclamation-marks",
              label: "No exclamation marks",
              pass: true,
              detail: "Coach text has no exclamation marks.",
            },
            {
              id: "exactly-one-next-step",
              label: "Exactly one next step present",
              pass: false,
              detail: "No next step found.",
            },
          ],
          judge: {
            scores: {
              evidenceOverEncouragement: 4,
              oneNextStep: 5,
              calmVoice: 5,
              honestAboutDistance: 4,
              actionHonesty: 5,
            },
            overall: 4,
            rationale: "Grounded and calm.",
          },
        },
      ],
    }

    const markdown = renderEvalReport(report)
    expect(markdown).toMatch(/^# Coach eval report/m)
    expect(markdown).toContain("Coach mode: free")
    expect(markdown).toContain("Coach model: stealth/ox-alpha")
    expect(markdown).toContain("| empty-cv-anxious | fail (1) | 4/5 |")
    expect(markdown).toContain("[pass] No exclamation marks")
    expect(markdown).toContain("[fail] Exactly one next step present")
    expect(markdown).toContain("Overall: 4/5")
    expect(markdown).toContain("Grounded and calm.")
    expect(markdown).toContain("1 scenarios. 0 passed every honesty check. 1 failed at least one.")
  })
})
