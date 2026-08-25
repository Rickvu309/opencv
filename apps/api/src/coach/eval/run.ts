/**
 * Manual Coach eval CLI. Never imported by vitest — `pnpm --filter api eval`.
 * Refuses without OPENROUTER_API_KEY and is excluded from CI.
 */
import { coachModelFromEnv } from "../../config.js"
import { createMigratedTestDb } from "../../test/harness.js"
import { assembleCoachTools } from "../tools.js"
import { createOpenRouterCoachRuntime } from "../runtime.js"
import { collectTranscript } from "./collect.js"
import { requireOpenRouterApiKey, scenariosToRun } from "./gate.js"
import { honestyPassed, scoreHonesty } from "./honesty.js"
import { judgeModelFromEnv, judgeTranscript } from "./judge.js"
import { renderEvalReport } from "./report.js"
import { GOLDEN_SCENARIOS } from "./scenarios.js"
import { evalUserMessage, seedGoldenScenario } from "./seed.js"
import type { EvalReport, ScenarioEvalResult } from "./types.js"

export async function runEvalHarness(env: NodeJS.ProcessEnv): Promise<EvalReport> {
  const apiKey = requireOpenRouterApiKey(env)
  const coachModel = coachModelFromEnv(env)
  const judgeModel = judgeModelFromEnv(env)
  const selected = scenariosToRun(GOLDEN_SCENARIOS, env.COACH_EVAL_SCENARIO?.trim())
  const results: ScenarioEvalResult[] = []

  for (const scenario of selected) {
    const { client, db } = await createMigratedTestDb()
    try {
      const seeded = await seedGoldenScenario(db, scenario)
      const runtime = createOpenRouterCoachRuntime({
        apiKey,
        model: coachModel,
        db,
      })
      const transcript = await collectTranscript(runtime, {
        userId: seeded.userId,
        threadId: seeded.threadId,
        history: [evalUserMessage(scenario.userMessage)],
      })
      const tools = assembleCoachTools({ db, userId: seeded.userId })
      const honesty = scoreHonesty(transcript, tools, scenario.expect)

      let judgeError: string | undefined
      let judge
      try {
        judge = await judgeTranscript(apiKey, judgeModel, scenario, transcript)
      } catch (error) {
        judgeError = error instanceof Error ? error.message : String(error)
      }

      results.push({ scenario, transcript, honesty, judge, judgeError })
    } finally {
      await client.close()
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    coachModel,
    judgeModel,
    results,
  }
}

async function main() {
  try {
    const report = await runEvalHarness(process.env)
    process.stdout.write(renderEvalReport(report))
    const failed = report.results.some((result) => !honestyPassed(result.honesty))
    if (failed) {
      process.exitCode = 1
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  }
}

void main()
