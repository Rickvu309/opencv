import {
  HIG_SOURCES,
  TEXT_SCALE,
  higFindings,
  higSizes,
  ringFindings,
} from "../../../packages/ui/src/lib/hig-rules.ts"
import { sizeLabel } from "../../../packages/ui/src/lib/viewport-grid.ts"

const SAMPLE_RULES = ["hig-contrast", "hig-text-size", "hig-reduced-motion"]

const count = (findings) =>
  `${findings.length} finding${findings.length === 1 ? "" : "s"}`

const CHECKED = {
  "hig-contrast": "contrast",
  "hig-reduced-motion": "motion",
}

function ruleCase(base, size, rule, findings, shot, checked) {
  const source = HIG_SOURCES[rule]
  return base(size, {
    ok: true,
    advisory: true,
    rule,
    source,
    checked,
    findings,
    problem: findings.length
      ? `${count(findings)}; first: ${findings[0].name} ${findings[0].measured}`
      : undefined,
    ...(findings.length && shot ? { shot } : {}),
  })
}

export async function higSampleCases(session, screen, grid, base) {
  const cases = []
  for (const viewport of higSizes(grid)) {
    const size = sizeLabel(viewport)
    await session.resize(viewport)
    const { sample, baseShot, clipShot } = await session.higSample({
      textScale: TEXT_SCALE,
      shotName: `${screen.id}-${size}-hig`,
    })
    const findings = higFindings(sample)
    for (const rule of SAMPLE_RULES)
      cases.push(
        ruleCase(
          base,
          size,
          rule,
          findings.filter((finding) => finding.rule === rule),
          rule === "hig-text-size" ? clipShot : baseShot,
          sample[CHECKED[rule]]?.length
        )
      )
  }
  return cases
}

export async function higRingCase(session, screen, size, base) {
  const { rings, shot } = await session.focusRings(
    `${screen.id}-${size}-hig-focus`
  )
  return ruleCase(
    base,
    size,
    "hig-focus-ring",
    ringFindings(rings),
    shot,
    rings.length
  )
}

export function higLine(item) {
  return `HIG ${item.screen} at ${item.size}: ${item.rule} (${item.source.page}: ${item.source.url}): ${item.problem}${item.shot ? `, screenshot ${item.shot}` : ""}, repro: ${item.repro}`
}

export const higFound = (cases) =>
  cases.filter((item) => item.advisory && item.findings?.length)
