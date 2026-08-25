import { honestyPassed } from "./honesty.js"
import type { EvalReport, HonestyCheckResult, ScenarioEvalResult } from "./types.js"

export function renderEvalReport(report: EvalReport): string {
  const lines = [
    "# Coach eval report",
    "",
    `Generated: ${report.generatedAt}`,
    `Coach model: ${report.coachModel}`,
    `Judge model: ${report.judgeModel}`,
    "",
    "## Summary",
    "",
    "| Scenario | Honesty | Judge |",
    "| --- | --- | --- |",
    ...report.results.map((result) => summaryRow(result)),
    "",
  ]

  for (const result of report.results) {
    lines.push(...renderScenario(result), "")
  }

  const honestyFails = report.results.filter(
    (result) => !honestyPassed(result.honesty)
  ).length
  lines.push(
    "## Totals",
    "",
    `${report.results.length} scenarios. ${
      report.results.length - honestyFails
    } passed every honesty check. ${honestyFails} failed at least one.`
  )

  return `${lines.join("\n")}\n`
}

function summaryRow(result: ScenarioEvalResult) {
  const honesty = honestyPassed(result.honesty)
    ? "pass"
    : `fail (${result.honesty.filter((check) => !check.pass).length})`
  const judge = result.judge
    ? `${formatScore(result.judge.overall)}/5`
    : result.judgeError
      ? "error"
      : "—"
  return `| ${result.scenario.id} | ${honesty} | ${judge} |`
}

function renderScenario(result: ScenarioEvalResult): string[] {
  const lines = [
    `## ${result.scenario.id} — ${result.scenario.title}`,
    "",
    result.scenario.description,
    "",
    `**User:** ${result.scenario.userMessage}`,
    "",
    "### Transcript",
    "",
    result.transcript.text || "_(empty Coach text)_",
    "",
  ]

  if (result.transcript.toolResults.length > 0) {
    lines.push("### Receipts", "")
    for (const receipt of result.transcript.toolResults) {
      lines.push(
        `- \`${receipt.name}\` ${receipt.ok ? "ok" : "fail"} — ${receipt.summary}`
      )
    }
    lines.push("")
  }

  if (result.transcript.error) {
    lines.push(`**Runtime error:** ${result.transcript.error}`, "")
  }

  lines.push("### Deterministic honesty", "")
  for (const check of result.honesty) {
    lines.push(formatCheck(check))
  }
  lines.push("")

  if (result.judge) {
    const { scores, overall, rationale } = result.judge
    lines.push(
      "### Judge",
      "",
      `Overall: ${formatScore(overall)}/5`,
      "",
      `- Evidence over encouragement: ${formatScore(scores.evidenceOverEncouragement)}/5`,
      `- One next step: ${formatScore(scores.oneNextStep)}/5`,
      `- Calm voice: ${formatScore(scores.calmVoice)}/5`,
      `- Honest about distance: ${formatScore(scores.honestAboutDistance)}/5`,
      `- Action honesty: ${formatScore(scores.actionHonesty)}/5`,
      "",
      rationale
    )
  } else if (result.judgeError) {
    lines.push("### Judge", "", `Judge failed: ${result.judgeError}`)
  }

  return lines
}

function formatCheck(check: HonestyCheckResult) {
  return `- [${check.pass ? "pass" : "fail"}] ${check.label} — ${check.detail}`
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
