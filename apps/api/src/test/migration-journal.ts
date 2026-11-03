import { readFileSync } from "node:fs"
import path from "node:path"

import { migrationsFolder } from "../db/paths.js"

export function journalTags(): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
  ) as { entries: { tag: string }[] }
  return journal.entries.map((entry) => entry.tag)
}

export function newestMigrationTag(): string {
  return journalTags().at(-1)!
}
