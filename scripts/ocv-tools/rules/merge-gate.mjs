export const LABELS = Object.freeze({
  ownerApproved: "owner-approved",
  productionRed: "production-red",
  productionRedRevert: "production-red-revert",
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
  const because = riskHighFiles(facts.diff?.files).map(
    (file) => `${file} attests the ci check`
  )
  for (const item of facts.migrations?.files ?? [])
    if (item.changes?.length)
      because.push(`migration ${item.tag} changes existing things`)
  return because
}

export function openProductionRed(issues) {
  return (issues ?? []).filter(
    (issue) =>
      issue.state === "OPEN" &&
      (issue.labels ?? []).includes(LABELS.productionRed)
  )
}
