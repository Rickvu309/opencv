import {
  HIG_SOURCES,
  TEXT_SCALE,
  higFindings,
  higSizes,
  ringFindings,
} from "../../../packages/ui/src/lib/hig-rules.ts"
import {
  parseSize,
  sizeLabel,
} from "../../../packages/ui/src/lib/viewport-grid.ts"

export const HIG_CALLOUTS = 10
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

const inside = (rect, viewport) =>
  rect &&
  rect.x + rect.width > 0 &&
  rect.y + rect.height > 0 &&
  rect.x < viewport.width &&
  rect.y < viewport.height

export function higSpec(item) {
  const viewport = parseSize(item.size)
  const source = item.source
  const placed = item.findings.filter((finding) =>
    inside(finding.rect, viewport)
  )
  const shown = placed.slice(0, HIG_CALLOUTS)
  const rest = item.findings.filter((finding) => !shown.includes(finding))
  return {
    sections: [
      {
        title: `${item.screen} at ${item.size}: ${item.rule}, ${source.page} (${source.url})`,
        image: item.shot,
        callouts: shown.map((finding, at) => ({
          n: at + 1,
          note: `${finding.name}: ${finding.measured}`,
          target: finding.rect,
        })),
        ...(rest.length
          ? {
              also: rest.map(
                (finding) => `${finding.name}: ${finding.measured}`
              ),
            }
          : {}),
      },
    ],
  }
}

export function higLine(item, specPath) {
  return `HIG ${item.screen} at ${item.size}: ${item.rule} (${item.source.page}: ${item.source.url}): ${item.problem}${item.shot ? ` · screenshot ${item.shot}` : ""}${specPath ? ` · annotate: node scripts/ui.mjs annotate --spec ${specPath} --out ${specPath.replace(/\.spec\.json$/, ".png")}` : ""} · repro: ${item.repro}`
}

export const higFound = (cases) =>
  cases.filter((item) => item.advisory && item.findings?.length)

export const hasShot = (item) =>
  typeof item.shot === "string" && item.shot.endsWith(".png")
