import { readFileSync } from "node:fs"
import path from "node:path"

import { migrationsFolder } from "../db/paths.js"

export type JournalEntry = { idx: number; when: number; tag: string }

const TAG_NUMBER_PREFIX = /^\d{4}_/

export function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
  ) as { entries: JournalEntry[] }
  return journal.entries.map(({ idx, when, tag }) => ({ idx, when, tag }))
}

export function journalTags(): string[] {
  return journalEntries().map((entry) => entry.tag)
}

export function newestTagByWhen(entries: JournalEntry[]): string {
  if (entries.length === 0) throw new Error("the migration journal is empty")
  return entries.reduce((newest, entry) =>
    entry.when > newest.when ? entry : newest
  ).tag
}

export function newestMigrationTag(): string {
  return newestTagByWhen(journalEntries())
}

export function journalTag(name: string): string {
  const matches = journalTags().filter(
    (tag) =>
      TAG_NUMBER_PREFIX.test(tag) && tag.replace(TAG_NUMBER_PREFIX, "") === name
  )
  if (matches.length !== 1) {
    throw new Error(
      `expected one journal migration named ${name}, found ${matches.length}`
    )
  }
  return matches[0]!
}
