import { spawnSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { withTempDir } from "./temp-dir.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const meta = "apps/api/drizzle/meta"

export function missingSnapshot(journal, snapshot) {
  const latest = journal.entries.at(-1)
  if (!latest) return ["migration journal is empty"]
  const name = `${String(latest.idx).padStart(4, "0")}_snapshot.json`
  return snapshot === null ? [`${name} is missing after ${latest.tag}`] : []
}

export function detect(
  source,
  file,
  io = {
    read: (name) =>
      existsSync(path.join(root, name))
        ? readFileSync(path.join(root, name), "utf8")
        : null,
  }
) {
  const journal = JSON.parse(source)
  const latest = journal.entries.at(-1)
  const name = `${String(latest?.idx).padStart(4, "0")}_snapshot.json`
  return missingSnapshot(journal, io.read(`${meta}/${name}`))
}

export function generateSql({
  schema = path.join(root, "apps/api/src/db/schema.ts"),
  migrations = path.join(root, "apps/api/drizzle"),
} = {}) {
  return withTempDir(
    "migration-snapshot-",
    (dir) => {
      cpSync(migrations, path.join(dir, "drizzle"), { recursive: true })
      const before = new Set(readdirSync(path.join(dir, "drizzle")))
      const result = spawnSync(
        process.execPath,
        [
          path.join(root, "apps/api/node_modules/drizzle-kit/bin.cjs"),
          "generate",
          "--dialect",
          "postgresql",
          "--schema",
          schema,
          "--out",
          "./drizzle",
        ],
        {
          cwd: dir,
          encoding: "utf8",
          timeout: 60_000,
          input: "",
          maxBuffer: 4 * 1024 * 1024,
        }
      )
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
      if (result.error || result.status !== 0 || /Error:|error:/.test(output))
        throw new Error(`drizzle generate failed: ${result.error ?? output}`)
      const sql = readdirSync(path.join(dir, "drizzle"))
        .filter((name) => name.endsWith(".sql") && !before.has(name))
        .map((name) => readFileSync(path.join(dir, "drizzle", name), "utf8"))
      if (!sql.length && !output.includes("No schema changes"))
        throw new Error(`drizzle generate did not finish: ${output}`)
      return sql
    },
    path.join(homedir(), "tmp")
  )
}
