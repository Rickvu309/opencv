import { run } from "./common.mjs"

export const LIVE_HEALTH = "curl -s https://api.opencv.me/health/deep"
const MIGRATION = /^apps\/api\/drizzle\/(\d{4}_[^/]+)\.sql$/
const TABLE = /"?([\w]+)"?\s*\.\s*"?([\w]+)"?|"?([\w]+)"?/
const CREATED = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi
const ALTERED = /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?([^\s]+)/gi
const CHANGES = [
  [/\bDROP\b/i, "DROP"],
  [/\bDELETE\s+FROM\b/i, "DELETE"],
  [/\bUPDATE\s+[^\s;]+\s+SET\b/i, "UPDATE"],
  [/\bTRUNCATE\b/i, "TRUNCATE"],
  [/\bCREATE\s+OR\s+REPLACE\b/i, "CREATE OR REPLACE"],
  [/\bTRIGGER\b/i, "a trigger"],
  [/\bALTER\s+(?!TABLE\b)\w+/i, "ALTER of a type, function or schema"],
  [/\bRENAME\b/i, "RENAME"],
]

const tableName = (raw) => {
  const m = TABLE.exec(raw)
  return (m?.[2] ?? m?.[3] ?? raw).toLowerCase()
}

export function migrationChanges(sql) {
  const text = String(sql).replace(/--[^\n]*/g, "")
  const reasons = CHANGES.filter(([pattern]) => pattern.test(text)).map(
    ([, label]) => label
  )
  const created = new Set(
    [...text.matchAll(CREATED)].map((m) => tableName(m[1]))
  )
  const altered = [
    ...new Set(
      [...text.matchAll(ALTERED)]
        .map((m) => tableName(m[1]))
        .filter((name) => !created.has(name))
    ),
  ]
  for (const name of altered) reasons.push(`ALTER TABLE ${name}`)
  return reasons
}

export function migrationTag(file) {
  return MIGRATION.exec(file)?.[1] ?? null
}

export function migrationFacts(ctx, files, head, allowed = []) {
  const list = (Array.isArray(files) ? files : String(files ?? "").split("\n"))
    .filter((file) => migrationTag(file))
    .sort()
  return {
    allowed,
    files: list.map((file) => {
      const shown = run(ctx, "git", ["show", `${head}:${file}`])
      return {
        file,
        tag: migrationTag(file),
        changes: shown.ok ? migrationChanges(shown.out) : ["unreadable"],
      }
    }),
  }
}

export function deployLines(migrations) {
  const lines = [
    "This merge deploys to production: main goes live within minutes, and any migration in it runs on production data.",
  ]
  for (const item of migrations.files)
    lines.push(
      item.changes.length
        ? `Migration ${item.file} changes what exists (${item.changes.join(", ")})${migrations.allowed.includes(item.tag) ? ", allowed by --allow-migration" : ""}.`
        : `Migration ${item.file} only adds tables and indexes.`
    )
  if (!migrations.files.length) lines.push("It carries no database migration.")
  return lines
}

export function liveCheckLine(mergeOid, migrations) {
  const newest = migrations.files.at(-1)?.tag
  return `See it live: ${LIVE_HEALTH} (it shows the live commit and schema version; expect ${String(mergeOid ?? "the merge commit").slice(0, 8)}${newest ? ` and ${newest}` : ""}).`
}
