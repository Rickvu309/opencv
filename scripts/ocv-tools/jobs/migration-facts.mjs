import { run } from "./common.mjs"
import { classifyMigration, splitStatements } from "./migration-statements.mjs"

export const LIVE_HEALTH = "curl -s https://api.opencv.me/health/deep"
const MIGRATION = /^apps\/api\/drizzle\/([^/]+)\.sql$/
const DRIZZLE = /^apps\/api\/drizzle\//
const DRIZZLE_KNOWN = /^apps\/api\/drizzle\/meta\/\d{4}_snapshot\.json$/
const JOURNAL = "apps/api/drizzle/meta/_journal.json"
const SHOWN = 90

const shorten = (text) =>
  text.length > SHOWN ? `${text.slice(0, SHOWN - 3)}...` : text

export function migrationChanges(sql) {
  return migrationReading(sql).changes
}

export function migrationReading(sql) {
  if (String(sql).includes("\uFFFD"))
    return {
      kinds: "",
      changes: [
        "the file is not UTF-8 text (or holds U+FFFD), so the scanner cannot read it as the database will",
      ],
    }
  const verdict = classifyMigration(sql)
  if (verdict.onlyAdds) return { kinds: verdict.kinds, changes: [] }
  const { n, text, why } = verdict.first
  return {
    kinds: "",
    changes: [n ? `statement ${n}, ${shorten(text)}: ${why}` : why],
  }
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

function unreadDrizzleFiles(changed, list) {
  const odd = changed.filter(
    (file) =>
      DRIZZLE.test(file) &&
      !migrationTag(file) &&
      !DRIZZLE_KNOWN.test(file) &&
      file !== JOURNAL
  )
  return odd.map((file) => ({
    file,
    tag: file.replace(DRIZZLE, ""),
    statements: 0,
    changes: [
      "a file under apps/api/drizzle the scanner does not read; it may change what drizzle runs",
    ],
  }))
}

function journalAt(ctx, rev) {
  const shown = run(ctx, "git", ["show", `${rev}:${JOURNAL}`])
  if (!shown.ok) return null
  try {
    const journal = JSON.parse(shown.out)
    return Array.isArray(journal?.entries) ? journal : null
  } catch {
    return null
  }
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function journalChange(ctx, head, changed) {
  const fork = run(ctx, "git", ["merge-base", "origin/main", head])
  const base = fork.ok && fork.out ? journalAt(ctx, fork.out) : null
  const next = journalAt(ctx, head)
  if (!base || !next)
    return "the migration journal could not be read at the base or the head, so what drizzle runs is unknown"
  const { entries: before, ...baseRest } = base
  const { entries: after, ...headRest } = next
  if (!sameJson(baseRest, headRest))
    return "the migration journal's header (version or dialect) changed"
  const edited = before.findIndex((entry, k) => !sameJson(entry, after[k]))
  if (edited >= 0)
    return `journal entry ${edited} (${before[edited]?.tag ?? "unnamed"}) changed or was removed, so drizzle may run an older migration again or skip one`
  let last = Math.max(0, ...before.map((entry) => Number(entry.when) || 0))
  for (const [k, entry] of after.slice(before.length).entries()) {
    const at = before.length + k
    const file = `apps/api/drizzle/${entry?.tag}.sql`
    if (entry?.idx !== at)
      return `journal entry ${at} (${entry?.tag ?? "unnamed"}) has idx ${entry?.idx}, not ${at}`
    if (
      !changed.includes(file) ||
      run(ctx, "git", ["cat-file", "-e", `${fork.out}:${file}`]).ok
    )
      return `journal entry ${at} names ${entry?.tag ?? "nothing"}, which is not a migration file this pull request adds, so drizzle would run a file this pull request did not add`
    if (!(Number(entry.when) > last))
      return `journal entry ${at} (${entry.tag}) has a when that is not after every earlier entry, so drizzle may skip or reorder it`
    last = Number(entry.when)
  }
  return null
}

export function migrationFacts(ctx, files, head, allowed = []) {
  if (files === undefined || files === null)
    return {
      allowed,
      files: [
        {
          file: "the changed files",
          tag: "unread-changed-files",
          statements: 0,
          changes: [
            "the list of changed files could not be read, so no migration can be ruled out",
          ],
        },
      ],
    }
  const changed = Array.isArray(files) ? files : String(files).split("\n")
  const list = changed.filter((file) => migrationTag(file)).sort()
  const journal = changed.includes(JOURNAL)
    ? journalChange(ctx, head, changed)
    : null
  return {
    allowed,
    files: [
      ...unreadDrizzleFiles(changed, list),
      ...(journal
        ? [
            {
              file: JOURNAL,
              tag: JOURNAL.replace(DRIZZLE, ""),
              statements: 0,
              changes: [journal],
            },
          ]
        : []),
      ...list.map((file) => {
        const shown = run(ctx, "git", ["show", `${head}:${file}`])
        const reading = shown.ok
          ? migrationReading(shown.out)
          : { kinds: "", changes: ["the file could not be read at this head"] }
        return {
          file,
          tag: migrationTag(file),
          statements: shown.ok ? migrationStatements(shown.out) : 0,
          kinds: reading.kinds,
          changes: reading.changes,
        }
      }),
    ],
  }
}

export function deployLines(migrations) {
  const lines = [
    "This merge deploys to production: main goes live within minutes, and any migration in it runs on production data.",
  ]
  for (const item of migrations.files)
    lines.push(
      item.changes.length
        ? `Migration ${item.file} CHANGES EXISTING THINGS: ${item.changes.join(", ")}${migrations.allowed.includes(item.tag) ? "; allowed by --allow-migration" : ""}.`
        : `Migration ${item.file}: the static reading found only additive statements (${item.kinds || `${item.statements} statement(s)`}). This is a reading of the SQL, not a proof.`
    )
  if (!migrations.files.length) lines.push("It carries no database migration.")
  return lines
}

export function liveCheckLine(mergeOid, migrations) {
  const newest = migrations.files.at(-1)?.tag
  return `See it live: ${LIVE_HEALTH} (it shows the live commit and schema version; expect ${String(mergeOid ?? "the merge commit").slice(0, 8)}${newest ? ` and ${newest}` : ""}).`
}
