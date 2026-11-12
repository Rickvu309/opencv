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
  if (String(sql).includes("\uFFFD"))
    return [
      "the file is not UTF-8 text (or holds U+FFFD), so the scanner cannot read it as the database will",
    ]
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

function unreadDrizzleFiles(changed, list) {
  const odd = changed.filter(
    (file) =>
      DRIZZLE.test(file) &&
      !migrationTag(file) &&
      !DRIZZLE_KNOWN.test(file) &&
      file !== JOURNAL
  )
  const journalOnly = changed.includes(JOURNAL) && !list.length
  return [
    ...odd.map((file) => ({
      file,
      tag: file.replace(DRIZZLE, ""),
      statements: 0,
      changes: [
        "a file under apps/api/drizzle the scanner does not read; it may change what drizzle runs",
      ],
    })),
    ...(journalOnly
      ? [
          {
            file: JOURNAL,
            tag: JOURNAL.replace(DRIZZLE, ""),
            statements: 0,
            changes: [
              "the migration journal changed without a migration file, so it may run a file this pull request did not change",
            ],
          },
        ]
      : []),
  ]
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
  return {
    allowed,
    files: [
      ...unreadDrizzleFiles(changed, list),
      ...list.map((file) => {
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
        ? `Migration ${item.file} changes what exists, first at ${item.changes.join(", ")}${migrations.allowed.includes(item.tag) ? "; allowed by --allow-migration" : ""}.`
        : `Migration ${item.file} only adds: each of its ${item.statements} statement(s) is on the only-adds list.`
    )
  if (!migrations.files.length) lines.push("It carries no database migration.")
  return lines
}

export function liveCheckLine(mergeOid, migrations) {
  const newest = migrations.files.at(-1)?.tag
  return `See it live: ${LIVE_HEALTH} (it shows the live commit and schema version; expect ${String(mergeOid ?? "the merge commit").slice(0, 8)}${newest ? ` and ${newest}` : ""}).`
}
