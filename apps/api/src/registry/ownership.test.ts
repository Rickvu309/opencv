import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Each table is written only by the files under its owner. auth.ts is Better
// Auth's own wiring and owns the auth tables with the account module.
const owners: Record<string, string[]> = {
  user: ["account", "auth.ts"],
  session: ["account", "auth.ts"],
  account: ["account", "auth.ts"],
  verification: ["account", "auth.ts"],
  notifyRequests: ["account"],
  chats: ["chat"],
  chatMessages: ["chat"],
  files: ["paper"],
  paperDocs: ["paper"],
  paperShares: ["paper"],
  jobs: ["job"],
  jobChecklist: ["job"],
  connections: ["inbox"],
  inboxThreads: ["inbox"],
  inboxMessages: ["inbox"],
  coachUsage: ["coach"],
  pendingActions: ["registry"],
  activity: ["registry"],
  idempotency: ["registry"],
}

// Tests and the coverage fixtures that only tests import may seed any table.
function isSupport(relative: string) {
  return (
    relative.endsWith(".test.ts") ||
    relative.endsWith(".type-test.ts") ||
    relative.startsWith(`test${path.sep}`) ||
    /^registry[\\/]coverage-/.test(relative)
  )
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return filesUnder(full)
    return full.endsWith(".ts") ? [full] : []
  })
}

function writesIn(text: string): string[] {
  return [...text.matchAll(/\.(?:insert|update|delete)\(\s*(\w+)\s*\)/g)].map(
    (match) => match[1] ?? ""
  )
}

function ownedBy(relative: string, owner: string) {
  return relative === owner || relative.startsWith(`${owner}${path.sep}`)
}

describe("table ownership", () => {
  it("maps every schema table to an owner", () => {
    const schema = readFileSync(path.join(srcRoot, "db/schema.ts"), "utf8")
    const tables = [
      ...schema.matchAll(/export const (\w+) = opencvApp\.table\(/g),
    ].map((match) => match[1] ?? "")
    expect(tables.length).toBeGreaterThan(0)
    expect(tables.filter((table) => !owners[table])).toEqual([])
    expect(
      Object.keys(owners).filter((name) => !tables.includes(name))
    ).toEqual([])
  })

  it("writes a table only from its owner's directory", () => {
    const violations: string[] = []
    for (const file of filesUnder(srcRoot)) {
      const relative = path.relative(srcRoot, file)
      if (isSupport(relative)) continue
      for (const table of writesIn(readFileSync(file, "utf8"))) {
        const allowed = owners[table]
        if (!allowed) continue
        if (allowed.some((owner) => ownedBy(relative, owner))) continue
        violations.push(`${relative} writes ${table}`)
      }
    }
    expect(violations).toEqual([])
  })
})
