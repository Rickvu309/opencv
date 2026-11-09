import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isTable } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import config from "../../vitest.config.js"
import * as schema from "../db/schema.js"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const writersOfTable: Record<string, string[]> = {
  agentToolCalls: ["connections"],
  agentConnections: ["connections"],
  oauthClient: ["connections", "auth.ts"],
  oauthResource: ["connections", "auth.ts"],
  oauthClientResource: ["connections", "auth.ts"],
  oauthRefreshToken: ["connections", "auth.ts"],
  oauthAccessToken: ["connections", "auth.ts"],
  oauthConsent: ["connections", "auth.ts"],
  oauthClientAssertion: ["connections", "auth.ts"],
  user: ["account", "auth.ts"],
  session: ["account", "auth.ts"],
  account: ["account", "auth.ts"],
  verification: ["account", "auth.ts", "auth-consent.ts"],
  notifyRequests: ["account"],
  chats: ["chat"],
  chatMessages: ["chat"],
  files: ["paper"],
  paperDocs: ["paper"],
  paperDocUpdates: ["paper"],
  paperShares: ["paper"],
  paperPackageVersions: ["paper"],
  paperPackageHeads: ["paper"],
  jobs: ["job"],
  jobChecklist: ["job"],
  connections: ["inbox"],
  inboxThreads: ["inbox"],
  inboxMessages: ["inbox"],
  coachUsage: ["coach"],
  coachTasks: ["coach"],
  taskEvents: ["coach"],
  taskCheckpoints: ["coach"],
  toolIntents: ["coach"],
  pendingActions: ["registry"],
  activity: ["registry"],
  idempotency: ["registry"],
}

function maySeedAnyTable(relative: string) {
  return (
    relative.endsWith(".test.ts") ||
    relative.endsWith(".type-test.ts") ||
    relative.startsWith(`test${path.sep}`) ||
    /^registry[\\/]coverage-/.test(relative) ||
    relative === path.join("paper", "photo-lifetime.support.ts")
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

describe("a table write from outside the owning module's directory is rejected", () => {
  it("maps every schema table to an owner", () => {
    const tables = Object.entries(schema)
      .filter(([, value]) => isTable(value))
      .map(([name]) => name)
    expect(tables.length).toBeGreaterThan(0)
    expect(
      tables.filter((table) => !writersOfTable[table]),
      "A table in apps/api/src/db/schema.ts has no row in `writersOfTable` in ownership.test.ts. Add the table with the module directory that writes it."
    ).toEqual([])
    expect(
      Object.keys(writersOfTable).filter((name) => !tables.includes(name)),
      "`writersOfTable` in ownership.test.ts names a table that apps/api/src/db/schema.ts no longer defines. Delete the row."
    ).toEqual([])
  })

  it("writes a table only from its owner's directory", () => {
    const violations: string[] = []
    for (const file of filesUnder(srcRoot)) {
      const relative = path.relative(srcRoot, file)
      if (maySeedAnyTable(relative)) continue
      for (const table of writesIn(readFileSync(file, "utf8"))) {
        const allowed = writersOfTable[table]
        if (!allowed) continue
        if (allowed.some((owner) => ownedBy(relative, owner))) continue
        violations.push(`${relative} writes ${table}`)
      }
    }
    expect(
      violations,
      `A table is written outside its owner. Move the write into the owning module and call it through that module's index.ts, or change the owner in \`writersOfTable\` in ownership.test.ts if ownership truly moved. Offending writes:\n${violations.join("\n")}`
    ).toEqual([])
  })

  it("contract.type-test.ts runs under the api typecheck script and vitest does not collect it", () => {
    expect(config.test?.exclude).toContain("src/**/*.type-test.ts")
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8")
    ) as { scripts: { typecheck: string } }
    expect(pkg.scripts.typecheck).toContain("tsc --noEmit")
    const tsconfig = JSON.parse(
      readFileSync(new URL("../../tsconfig.json", import.meta.url), "utf8")
    ) as { include: string[] }
    expect(tsconfig.include).toContain("src")
    expect(
      filesUnder(srcRoot).some((file) => file.endsWith("contract.type-test.ts"))
    ).toBe(true)
  })
})
