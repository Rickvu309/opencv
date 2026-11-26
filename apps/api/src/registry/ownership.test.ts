import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { getTableName, isTable } from "drizzle-orm"
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core"
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
  authLimitCounters: ["auth-email-limit.ts"],
  notifyRequests: ["account"],
  chats: ["coach/chat"],
  chatMessages: ["coach/chat"],
  files: ["paper"],
  paperDocs: ["paper"],
  paperDocUpdates: ["paper"],
  paperShares: ["paper"],
  paperPackageVersions: ["paper"],
  paperPackageHeads: ["paper"],
  paperPackageCandidates: ["paper"],
  paperPackageTrash: ["paper"],
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

const contextOfWriter: Record<string, string> = {
  account: "Account",
  "auth-email-limit.ts": "Account",
  registry: "Control",
  paper: "Paper",
  job: "Apply",
  inbox: "Inbox",
  "coach/chat": "Coach",
  coach: "Coach",
  connections: "Agents",
}

const linksBetweenContexts: Record<string, string[]> = {
  "Agents to Account": [
    "oauthRefreshToken.session_id -> session",
    "oauthAccessToken.session_id -> session",
  ],
  "Apply to Paper": [
    "jobs.cv_doc_id -> paperDocs",
    "jobs.letter_doc_id -> paperDocs",
    "jobs.cv_package_id -> paperPackageHeads",
    "jobs.letter_package_id -> paperPackageHeads",
  ],
  "Inbox to Apply": ["inboxThreads.job_id -> jobs"],
  "Control to Coach": [
    "pendingActions.chat_id -> chats",
    "pendingActions.coach_task_id -> coachTasks",
    "pendingActions.turn_id -> coachUsage",
    "activity.turn_id -> coachUsage",
  ],
  "Control to Agents": [
    "pendingActions.delegate_connection_id -> agentConnections",
  ],
  "Coach to Control": [
    "toolIntents.proposal_id -> pendingActions",
    "toolIntents.activity_id -> activity",
  ],
}

function contextOf(table: string) {
  const writer = writersOfTable[table]?.[0]
  return writer ? contextOfWriter[writer] : undefined
}

describe("a database link from one context's table to another context's table is named", () => {
  const tables = Object.entries(schema).filter(([, value]) => isTable(value))
  const schemaNameOf = new Map(
    tables.map(([name, value]) => [getTableName(value as PgTable), name])
  )

  it("gives every table a context", () => {
    expect(
      tables.map(([name]) => name).filter((name) => !contextOf(name)),
      "A table's first writer in `writersOfTable` has no row in `contextOfWriter` in ownership.test.ts. Add the writer with its context."
    ).toEqual([])
  })

  it("lists every link that crosses two contexts, and the list cannot grow", () => {
    const found: Record<string, string[]> = {}
    for (const [name, value] of tables) {
      for (const key of getTableConfig(value as PgTable).foreignKeys) {
        const reference = key.reference()
        const target = schemaNameOf.get(getTableName(reference.foreignTable))
        if (!target || target === "user") continue
        const from = contextOf(name)
        const to = contextOf(target)
        if (from === to) continue
        const columns = reference.columns.map((column) => column.name).join("+")
        ;(found[`${from} to ${to}`] ??= []).push(
          `${name}.${columns} -> ${target}`
        )
      }
    }
    const sorted = (links: Record<string, string[]>) =>
      Object.entries(links)
        .flatMap(([between, each]) => each.map((link) => `${between}: ${link}`))
        .sort()
    expect(
      sorted(found),
      "A table points at a table another context owns. A context owns its tables: keep the other context's id as a plain column and reach its data through its operations. If the link must exist, name it in `linksBetweenContexts` in ownership.test.ts. Links to the person are allowed."
    ).toEqual(sorted(linksBetweenContexts))
    expect(
      sorted(linksBetweenContexts).length,
      "`linksBetweenContexts` in ownership.test.ts only shrinks. Remove a link before adding one."
    ).toBeLessThanOrEqual(14)
  })
})

const readsBetweenContexts: string[] = [
  "account/operations/profile/set-photo/server.ts reads files",
  "account/queries.ts reads activity",
  "account/queries.ts reads chatMessages",
  "account/queries.ts reads chats",
  "account/queries.ts reads connections",
  "account/queries.ts reads files",
  "account/queries.ts reads jobChecklist",
  "account/queries.ts reads jobs",
  "account/queries.ts reads paperDocs",
  "account/usage.ts reads coachUsage",
  "coach/chat/agent-proposal.ts reads pendingActions",
  "coach/chat/store.ts reads activity",
  "coach/task-reader.ts reads pendingActions",
  "coach/task-start.ts reads user",
  "coach/usage-store.ts reads user",
  "connections/call-store.ts reads user",
  "inbox/store.ts reads jobs",
  "inbox/store.ts reads user",
  "job/latest-note.ts reads activity",
  "job/linked-papers.ts reads paperDocs",
  "job/linked-papers.ts reads paperPackageHeads",
  "job/linked-papers.ts reads paperPackageVersions",
  "paper/word-page-export.ts reads jobs",
  "paper/word-page-trash.ts reads jobs",
  "registry/delegate-policy.ts reads agentConnections",
  "registry/proposals.ts reads user",
  "registry/registry-reads.ts reads user",
  "registry/task-fence.ts reads coachTasks",
]

function readsIn(text: string): string[] {
  return [
    ...text.matchAll(
      /\.(?:from|innerJoin|leftJoin|rightJoin|fullJoin)\(\s*(\w+)\s*[,)]/g
    ),
  ].map((match) => match[1] ?? "")
}

function contextOfFile(relative: string) {
  const writer = Object.keys(contextOfWriter)
    .filter((key) => ownedBy(relative, key))
    .sort((a, b) => b.length - a.length)[0]
  return writer ? contextOfWriter[writer] : undefined
}

describe("a context reads another context's table only where it is named", () => {
  it("lists every read across two contexts, and the list cannot grow", () => {
    const found = new Set<string>()
    for (const file of filesUnder(srcRoot)) {
      const relative = path.relative(srcRoot, file)
      if (
        maySeedAnyTable(relative) ||
        relative.includes("test-support") ||
        relative.split(path.sep).includes("test")
      )
        continue
      const reader = contextOfFile(relative)
      if (!reader) continue
      for (const table of readsIn(readFileSync(file, "utf8"))) {
        const owner = contextOf(table)
        if (!owner || owner === reader) continue
        found.add(`${relative.split(path.sep).join("/")} reads ${table}`)
      }
    }
    expect(
      [...found].sort(),
      "A context reads a table another context owns. Read it through the owner's operation instead (registry.read or the owner's index.ts). If the read must stay, name it in `readsBetweenContexts` in ownership.test.ts."
    ).toEqual([...readsBetweenContexts].sort())
    expect(
      readsBetweenContexts.length,
      "`readsBetweenContexts` in ownership.test.ts only shrinks. Remove a read before adding one."
    ).toBeLessThanOrEqual(34)
  })
})
