export const LABELS = Object.freeze({
  productionRed: "production-red",
  productionRedRevert: "production-red-revert",
  mainRed: "main-red",
  allowMigration: "allow-migration",
})

const RISK_HIGH_FILES = [
  ".github/workflows/ci.yml",
  ".github/workflows/nightly.yml",
  "scripts/check.mjs",
  ".github/rulesets/main.json",
]

const ALLOW_MIGRATION_PREFIX = `${LABELS.allowMigration}:`

function asLines(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === "") return []
  return String(value).split("\n").filter(Boolean)
}

export function riskHighFiles(files) {
  return asLines(files).filter(
    (file) =>
      RISK_HIGH_FILES.includes(file) || file.startsWith(".github/actions/")
  )
}

const MERGE_GATE_FILES = [
  "scripts/ocv-tools.mjs",
  "scripts/lib/ci-workflow.mjs",
  ".github/labels.yml",
  "scripts/check.mjs",
]

const MERGE_GATE_FOLDERS = [
  "scripts/ocv-tools/",
  ".githooks/",
  ".github/workflows/",
  ".github/actions/",
  ".github/rulesets/",
]

export function mergeGateFiles(files) {
  return asLines(files).filter(
    (file) =>
      MERGE_GATE_FILES.includes(file) ||
      MERGE_GATE_FOLDERS.some((folder) => file.startsWith(folder))
  )
}

export const RETIRED_DIR = "scripts/retired"
export const RETIRED_FILE = /^scripts\/retired\/(\d+)\.json$/

export function allowMigrationLabel(tag) {
  return `${ALLOW_MIGRATION_PREFIX}${tag}`
}

export function allowedMigrationTags(labels) {
  return (labels ?? [])
    .filter((label) => String(label).startsWith(ALLOW_MIGRATION_PREFIX))
    .map((label) => String(label).slice(ALLOW_MIGRATION_PREFIX.length))
    .filter(Boolean)
}

export function ownerBecause(facts) {
  const risky = riskHighFiles(facts.diff?.files)
  const because = [
    ...risky.map((file) => `${file} attests the ci check`),
    ...mergeGateFiles(facts.diff?.files)
      .filter((file) => !risky.includes(file))
      .map((file) => `${file} decides what may merge`),
  ]
  for (const item of facts.protected?.retired ?? [])
    if (item.class !== "self") {
      const line = `${item.retiredBy} is retired with ${item.because}`
      if (!because.includes(line)) because.push(line)
    }
  for (const item of facts.migrations?.files ?? [])
    if (item.changes?.length)
      because.push(`migration ${item.tag} changes existing things`)
  return because
}

export const RED_PLACES = Object.freeze([
  [LABELS.productionRed, "production"],
  [LABELS.mainRed, "main"],
])

export function openRedIssues(issues) {
  return (issues ?? []).filter(
    (issue) =>
      issue.state === "OPEN" &&
      RED_PLACES.some(([label]) => (issue.labels ?? []).includes(label))
  )
}
