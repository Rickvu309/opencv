import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"

import { personActor } from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { withDatabase, type TestDatabase } from "../db/context.js"
import { engineLog } from "../paper/engine-sync-log.js"
import { paperDocs, user } from "../db/schema.js"
import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"
import {
  IMPORT_CASES,
  ROUTE_CASES,
  routeGaps,
  type Person,
  type RouteCase,
} from "../test/routes/route-cases.js"
import { lastWrite, writesAfter, type LoggedWrite } from "../test/write-log.js"
import { coverageCases } from "./coverage-setup.test-support.js"
import { installRegistry } from "../install.js"
import {
  OWNED_READS,
  listReadsOf,
  ownedTables,
  ratchetProblems,
  rerunBreaks,
  rowBreaks,
  shown,
  type OwnedTable,
} from "./owned.js"
import type { Registry } from "./registry.js"

const KNOWN_REDS = z
  .record(z.string(), z.number().int().positive())
  .parse(
    JSON.parse(
      readFileSync(new URL("./owned-known-reds.json", import.meta.url), "utf8")
    )
  )

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Db = TestDatabase

const IMPORT_NAMES = new Map<RouteCase, string>(
  Object.entries(IMPORT_CASES).map(([name, routeCase]) => [routeCase, name])
)
type Found = Map<string, string[]>

function mentions(value: unknown, id: string): boolean {
  if (value === id) return true
  if (Array.isArray(value)) return value.some((item) => mentions(item, id))
  if (value && typeof value === "object")
    return Object.values(value).some((item) => mentions(item, id))
  return false
}

function answerOf(error: unknown, masks: readonly string[]) {
  const code = (error as { code?: unknown }).code
  const status = (error as { status?: unknown }).status
  let message = error instanceof Error ? error.message : String(error)
  for (const mask of masks) message = message.replaceAll(mask, "<id>")
  return `${String(code)} ${String(status)} ${message}`
}

async function answer(work: () => Promise<unknown>, masks: readonly string[]) {
  try {
    await work()
    return "ok"
  } catch (error) {
    return answerOf(error, masks)
  }
}

function swapIds(value: unknown, swap: Map<string, string>): unknown {
  if (typeof value === "string") return swap.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => swapIds(item, swap))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, swapIds(item, swap)])
    )
  return value
}

function note(found: Found, key: string, detail: string) {
  const details = found.get(key) ?? []
  details.push(detail)
  found.set(key, details)
}

class OwnedWatch {
  readonly found: Found = new Map()
  readonly owned = new Map<string, OwnedTable>()
  readonly registry: Registry = installRegistry()
  rowsChecked = 0
  readonly inserted = new Set<string>()
  private seen = 0

  async catchUp() {
    const writes = await writesAfter(this.db, this.seen)
    this.remember(writes)
    this.seen = writes.at(-1)?.seq ?? this.seen
  }
  rerunsCompared = 0

  constructor(
    readonly db: Db,
    readonly owner: string,
    readonly stranger: string
  ) {}

  remember(writes: readonly LoggedWrite[]) {
    for (const write of writes) {
      if (write.owner !== this.owner) continue
      this.owned.set(OWNED_READS[write.table].idOf(write.row), write.table)
    }
  }

  namedIn(value: unknown) {
    const swap = new Map<string, string>()
    let named: OwnedTable | null = null
    for (const [id, table] of this.owned) {
      if (!UUID.test(id) || !mentions(value, id)) continue
      swap.set(id, randomUUID())
      named ??= table
    }
    return { swap, named, masks: [...swap.keys(), ...swap.values()] }
  }

  private read(name: string, input: Record<string, unknown>, userId: string) {
    const qualified =
      name === "paper.list" || (name === "paper.read" && input.view === "info")
        ? { ...input, writer: RICH_NATIVE_WRITER }
        : input
    return this.registry.read(name, qualified, personActor(userId))
  }

  async checkRows(where: string, writes: readonly LoggedWrite[]) {
    this.remember(writes)
    const latest = new Map<
      string,
      { table: OwnedTable; id: string; op: string; visible: boolean }
    >()
    for (const write of writes) {
      if (write.owner !== this.owner) continue
      const id = OWNED_READS[write.table].idOf(write.row)
      if (write.op === "insert") this.inserted.add(`${where}|${write.table}`)
      latest.set(`${write.table}:${id}`, {
        table: write.table,
        id,
        op: write.op,
        visible: shown(write.table, write.row),
      })
    }
    const lists = new Map<string, unknown>()
    const listed = async (name: string, userId: string) => {
      const key = `${name}:${userId}`
      if (!lists.has(key))
        lists.set(key, await this.read(name, {}, userId).catch(() => null))
      return lists.get(key)
    }
    for (const { table, id, op, visible } of latest.values()) {
      if (op === "delete") continue
      const reads = OWNED_READS[table]
      const names = visible ? listReadsOf(reads) : []
      let ownerListed: boolean | null = null
      let strangerListed: boolean | null = null
      if (names.length > 0) {
        ownerListed = false
        strangerListed = false
        for (const name of names) {
          if (mentions(await listed(name, this.owner), id)) ownerListed = true
          if (mentions(await listed(name, this.stranger), id))
            strangerListed = true
        }
      }
      let ownerOpens: boolean | null = null
      let strangerOpen: string | null = null
      let missingOpen: string | null = null
      if (reads.open !== "none" && reads.openInput) {
        const open = reads.open
        const input = reads.openInput
        const missing = randomUUID()
        const masks = [id, missing]
        ownerOpens = visible
          ? (await answer(
              () => this.read(open, input(id), this.owner),
              masks
            )) === "ok"
          : null
        strangerOpen = await answer(
          () => this.read(open, input(id), this.stranger),
          masks
        )
        missingOpen = await answer(
          () => this.read(open, input(missing), this.stranger),
          masks
        )
      }
      this.rowsChecked += 1
      for (const broken of rowBreaks({
        ownerListed,
        ownerOpens,
        strangerListed,
        strangerOpen,
        missingOpen,
      }))
        note(this.found, `${table}:${broken}`, `${where} wrote ${id}`)
    }
  }

  async rerun(
    where: string,
    input: unknown,
    asStranger: (value: unknown, masks: readonly string[]) => Promise<string>
  ) {
    const { swap, named, masks } = this.namedIn(input)
    const before = await lastWrite(this.db)
    const strangerAnswer = await asStranger(input, masks)
    const touched = (await writesAfter(this.db, before))
      .filter((write) => write.owner === this.owner)
      .map((write) => write.table)
    const missingAnswer = named
      ? await asStranger(swapIds(input, swap), masks)
      : null
    if (named) this.rerunsCompared += 1
    for (const key of rerunBreaks({
      touched,
      named,
      strangerAnswer,
      missingAnswer,
    }))
      note(
        this.found,
        key,
        `${where} as a stranger answered "${strangerAnswer}" and a missing id answered "${missingAnswer}"`
      )
  }
}

const PAGE_TABLES: readonly OwnedTable[] = ["paperDocs", "paperPackageHeads"]

const COMMAND_PAGE_CREATORS = [
  "paper.create",
  "paper.duplicate",
  "paper.start",
  "paper.import",
].map((name) => `command case ${name}`)

const ROUTE_PAGE_CREATORS = [
  "route POST /api/paper/import docx",
  "route POST /api/paper/import pdf",
  "route POST /api/paper/import txt",
]

function silentCreators(watch: OwnedWatch, creators: readonly string[]) {
  return creators.filter(
    (where) =>
      !PAGE_TABLES.some((table) => watch.inserted.has(`${where}|${table}`))
  )
}

const summary: string[] = []

const UNLISTED = (Object.keys(OWNED_READS) as OwnedTable[]).filter(
  (table) => OWNED_READS[table].list === "unlisted"
)

describe("every row a person makes is listed, opens for them, and stays hidden from others", () => {
  it("holds OWN-1 to OWN-5 after every command coverage case", async () => {
    const { db, client } = await createMigratedTestDb()
    const owner = "user-owned-owner"
    const stranger = "user-owned-stranger"
    await db.insert(user).values([
      { id: owner, name: "Ada", email: "ada-coverage@example.com" },
      { id: stranger, name: "Eve", email: "eve-owned@example.com" },
    ])
    const watch = new OwnedWatch(db, owner, stranger)
    const strangerActor = personActor(stranger)
    const { cases } = coverageCases(db, owner, {
      run: (inner) => async (name, input) => {
        const result = await inner(name, input)
        await watch.catchUp()
        await watch.rerun(`command ${name}`, input, (value, masks) =>
          answer(
            () =>
              watch.registry.execute({
                name,
                input: value,
                actor: strangerActor,
              }),
            masks
          )
        )
        return result
      },
      undo: (inner, registry) => async (result) => {
        const activityId = result.activityId
        if (activityId) {
          await watch.rerun("undo", { activityId }, async (value, masks) => {
            const id = (value as { activityId: string }).activityId
            return answer(() => registry.undo(stranger, id), masks)
          })
        }
        await inner(result)
      },
    })
    await withDatabase(db, async () => {
      for (const row of cases) {
        const before = await lastWrite(db)
        await row.arrange()
        const result = await row.act()
        await row.assert(result)
        if (row.undoAssert) await row.undoAssert(result)
        await watch.checkRows(
          `command case ${row.name}`,
          await writesAfter(db, before)
        )
      }
    })
    summary.push(
      `command cases: ${cases.length}, rows checked: ${watch.rowsChecked}, stranger reruns compared: ${watch.rerunsCompared}`
    )
    expect(
      silentCreators(watch, COMMAND_PAGE_CREATORS),
      "each page creator writes a page row the write log records"
    ).toEqual([])
    commandFound = watch.found
    await client.close()
  }, 120_000)

  it("holds OWN-1 to OWN-5 after every route case", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db, {
      fetchJobPosting: async () => ({ ok: false, message: "offline" }),
    })
    const people = await Promise.all(
      ["owner", "stranger"].map(async (name) => {
        const signed = await signUp(app, {
          name,
          email: `${name}-routes@example.com`,
        })
        const session = await app.request("/api/auth/get-session", {
          headers: authHeaders(signed.cookie),
        })
        const userId = z
          .object({ user: z.object({ id: z.string() }) })
          .parse(await session.json()).user.id
        const person: Person = {
          userId,
          cookie: signed.cookie,
          db,
          fetch: async (request) => app.request(request),
          command: async (command, input) => {
            const response = await app.request(`/api/commands/${command}`, {
              method: "POST",
              headers: authHeaders(signed.cookie),
              body: JSON.stringify({ input, idempotencyKey: randomUUID() }),
            })
            const body = (await response.json()) as {
              data?: Record<string, unknown>
            }
            if (response.status !== 200 || !body.data)
              throw new Error(`${command}: ${JSON.stringify(body)}`)
            return body.data
          },
        }
        return person
      })
    )
    expect(
      routeGaps(app, ROUTE_CASES),
      "every route outside the command door and the sign-in library has a route case"
    ).toEqual([])
    const [owner, stranger] = people as [Person, Person]
    const watch = new OwnedWatch(db, owner.userId, stranger.userId)
    const ownerFailures: string[] = []
    const send = async (
      routeCase: RouteCase,
      as: Person,
      ids: Record<string, string>
    ) => {
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), 10_000)
      try {
        const response = await as.fetch(
          routeCase.request(as, ids, abort.signal)
        )
        const text = await response.text().catch(() => "")
        const code = /"code":"([A-Z_]+)"/.exec(text)?.[1] ?? ""
        return { status: response.status, answer: `${response.status} ${code}` }
      } finally {
        clearTimeout(timer)
      }
    }
    for (const routeCase of ROUTE_CASES) {
      const where = [
        `route ${routeCase.method} ${routeCase.path}`,
        IMPORT_NAMES.get(routeCase),
      ]
        .filter(Boolean)
        .join(" ")
      const before = await lastWrite(db)
      const ids = await withDatabase(db, () => routeCase.arrange(owner))
      const sent = await send(routeCase, owner, ids)
      if (sent.status >= 500)
        ownerFailures.push(`${where} answered ${sent.answer} for its owner`)
      await withDatabase(db, async () => {
        await engineLog.settleFirstPages()
        await watch.checkRows(where, await writesAfter(db, before))
        await watch.rerun(
          where,
          ids,
          async (value) =>
            (await send(routeCase, stranger, value as Record<string, string>))
              .answer
        )
      })
    }
    summary.push(
      `route cases: ${ROUTE_CASES.length}, rows checked: ${watch.rowsChecked}, stranger reruns compared: ${watch.rerunsCompared}`
    )
    expect(
      silentCreators(watch, ROUTE_PAGE_CREATORS),
      "each import writes a page row the write log records"
    ).toEqual([])
    routeFound = watch.found
    expect(ownerFailures).toEqual([])
    await client.close()
  }, 120_000)

  it("lists no red outside the known-reds ratchet, and no ratchet entry that holds", () => {
    const found: Found = new Map()
    for (const source of [commandFound, routeFound])
      for (const [key, details] of source)
        for (const detail of details) note(found, key, detail)
    expect(ratchetProblems(found, KNOWN_REDS)).toEqual([])
  })
})

let commandFound: Found = new Map()
let routeFound: Found = new Map()

describe("the owned-row kind enrols every owned table and judges each sighting", () => {
  it(`names its reads for every owned table, and leaves these unlisted: ${UNLISTED.join(", ")}`, () => {
    expect(Object.keys(OWNED_READS).sort()).toEqual(
      Object.keys(ownedTables).sort()
    )
    expect(Object.keys(ownedTables)).toContain("paperPackageHeads")
    expect(Object.keys(ownedTables)).not.toContain("paperShares")
  })

  it("records a page row written by raw SQL or by the query builder, which a text guard cannot see", async () => {
    const { db, client } = await createMigratedTestDb()
    await db.insert(user).values({
      id: "user-variant",
      name: "Ada",
      email: "ada-variant@example.com",
    })
    const before = await lastWrite(db)
    const rawId = randomUUID()
    const builtId = randomUUID()
    await db.execute(
      sql.raw(
        `insert into opencv_app.paper_docs (id, user_id, kind, name, content_version) values ('${rawId}', 'user-variant', 'cv', 'Raw', 1)`
      )
    )
    const pages = paperDocs
    await db.insert(pages).values({
      id: builtId,
      userId: "user-variant",
      kind: "cv",
      name: "Built",
      contentVersion: 1,
    })
    const writes = await writesAfter(db, before)
    expect(
      writes.map((write) => [write.table, write.op, write.owner, write.row.id])
    ).toEqual([
      ["paperDocs", "insert", "user-variant", rawId],
      ["paperDocs", "insert", "user-variant", builtId],
    ])
    await client.close()
  })

  it("fires on a row the owner cannot list or open, or a stranger can see", () => {
    const clean = {
      ownerListed: true,
      ownerOpens: true,
      strangerListed: false,
      strangerOpen: "NOT_FOUND 404 Not found",
      missingOpen: "NOT_FOUND 404 Not found",
    }
    expect(rowBreaks(clean)).toEqual([])
    expect(rowBreaks({ ...clean, ownerListed: false })).toEqual(["OWN-1"])
    expect(rowBreaks({ ...clean, ownerOpens: false })).toEqual(["OWN-2"])
    expect(
      rowBreaks({ ...clean, strangerOpen: "FORBIDDEN 403 Not yours" })
    ).toEqual(["OWN-3"])
    expect(rowBreaks({ ...clean, strangerListed: true })).toEqual(["OWN-4"])
    expect(
      rowBreaks({
        ownerListed: null,
        ownerOpens: null,
        strangerListed: null,
        strangerOpen: null,
        missingOpen: null,
      })
    ).toEqual([])
  })

  it("fires when a stranger's rerun touches the owner's rows or answers unlike a missing id", () => {
    const clean = {
      touched: [],
      named: "jobs" as const,
      strangerAnswer: "NOT_FOUND 404 Job not found",
      missingAnswer: "NOT_FOUND 404 Job not found",
    }
    expect(rerunBreaks(clean)).toEqual([])
    expect(rerunBreaks({ ...clean, touched: ["jobs"] })).toEqual(["jobs:OWN-5"])
    expect(rerunBreaks({ ...clean, strangerAnswer: "ok" })).toEqual([
      "jobs:OWN-5",
    ])
    expect(
      rerunBreaks({
        ...clean,
        named: null,
        strangerAnswer: "ok",
        missingAnswer: null,
      })
    ).toEqual([])
  })

  it("refuses a new red and a ratchet entry that holds, so the ratchet only shrinks", () => {
    const found = new Map([["jobs:OWN-1", ["case wrote j1"]]])
    expect(ratchetProblems(found, { "jobs:OWN-1": 1468 })).toEqual([])
    expect(ratchetProblems(found, {})).toHaveLength(1)
    expect(ratchetProblems(new Map(), { "jobs:OWN-1": 1468 })).toEqual([
      "jobs:OWN-1 holds now. Remove it from apps/api/src/registry/owned-known-reds.json.",
    ])
  })
})
