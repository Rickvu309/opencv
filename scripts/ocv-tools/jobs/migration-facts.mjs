import { run } from "./common.mjs"
import { classifyMigration, splitStatements } from "./migration-statements.mjs"

export const LIVE_HEALTH = "curl -s https://api.opencv.me/health/deep"
const MIGRATION = /^apps\/api\/drizzle\/(\d{4}_[^/]+)\.sql$/
const SHOWN = 90

const shorten = (text) =>
  text.length > SHOWN ? `${text.slice(0, SHOWN - 3)}...` : text

export function migrationChanges(sql) {
  const verdict = classifyMigration(sql)
  if (verdict.onlyAdds) return []
  const { n, text, why } = verdict.first
  return [n ? `statement ${n}, ${shorten(text)}: ${why}` : why]
}

export function migrationStatements(sql) {
  try {
    return splitStatements(sql).length
  } catch {
    return 0
  }
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
        statements: shown.ok ? migrationStatements(shown.out) : 0,
        changes: shown.ok
          ? migrationChanges(shown.out)
          : ["the file could not be read at this head"],
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
        ? `Migration ${item.file} changes what exists, first at ${item.changes.join(", ")}${migrations.allowed.includes(item.tag) ? "; allowed by --allow-migration" : ""}.`
        : item.statements
          ? `Migration ${item.file} only adds: each of its ${item.statements} statement(s) is on the only-adds list.`
          : `Migration ${item.file} has no statements.`
    )
  if (!migrations.files.length) lines.push("It carries no database migration.")
  return lines
}

export function liveCheckLine(mergeOid, migrations) {
  const newest = migrations.files.at(-1)?.tag
  return `See it live: ${LIVE_HEALTH} (it shows the live commit and schema version; expect ${String(mergeOid ?? "the merge commit").slice(0, 8)}${newest ? ` and ${newest}` : ""}).`
}
