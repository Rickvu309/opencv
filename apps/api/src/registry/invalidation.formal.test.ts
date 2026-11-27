import {
  coachActor,
  catalog,
  resourcesOverlap,
  queries,
  type QueryName,
  type QueryRef,
  type ResourceRef,
} from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { withDatabase, type TestDatabase } from "../db/context.js"
import {
  activity,
  chats,
  files,
  inboxThreads,
  jobChecklist,
  jobs,
  paperDocs,
  paperShares,
  user,
} from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { coverageCases } from "./coverage-setup.test-support.js"
import type { Registry } from "./registry.js"
import type { Actor } from "@workspace/domain/kernel"

type ReadSpec = {
  query: QueryName
  input: Record<string, unknown>
  asCoach?: boolean
}
type Snapshot = Map<string, string>
type Observation = {
  scenario: string
  command: string
  inputs: unknown[]
  changed: ReadSpec[]
}
type InvalidatesTable = Record<string, (input: unknown) => QueryRef[]>

type Ids = {
  jobs: string[]
  docs: string[]
  tokens: string[]
  files: string[]
  chats: string[]
  threads: string[]
  items: { jobId: string; itemId: string }[]
  touchesPair: (docId: string, jobId: string) => boolean
}

const WIDE_CALENDAR = { from: "1970-01-01", to: "2100-01-01" }

const SNAPSHOT_QUERIES: {
  [N in QueryName]: ((ids: Ids) => Record<string, unknown>[]) | null
} = {
  "connections.list": () => [{}],
  "job.list": () => [{}],
  "job.priorityCounts": () => [{}],
  "job.get": (ids) => ids.jobs.map((jobId) => ({ jobId })),
  "job.checklistItem": (ids) => ids.items,
  "job.preview": null,
  "job.calendar": () => [WIDE_CALENDAR],
  "inbox.list": () => [{}],
  "inbox.snoozed": () => [{}],
  "inbox.get": (ids) => ids.threads.map((threadId) => ({ threadId })),
  "paper.list": () => [{}, { writer: RICH_NATIVE_WRITER }],
  "paper.read": (ids) => [
    { view: "library" },
    ...ids.docs.map((docId) => ({ view: "info", docId })),
    ...ids.docs.map((docId) => ({ docId })),
  ],
  "paper.changes": null,
  "paper.head": null,
  "paper.export": null,
  "file.get": (ids) => ids.files.map((fileId) => ({ fileId })),
  "paper.files": () => [{}],
  "paper.outline": (ids) => ids.docs.map((docId) => ({ docId })),
  "profile.get": () => [{}],
  "integrations.list": () => [{}],
  "billing.get": () => [{}],
  "coach.usage": () => [{}],
  "coach.status": null,
  "coach.events": null,
  "activity.list": null,
  "chat.list": () => [{}],
  "chat.get": (ids) => ids.chats.map((chatId) => ({ chatId })),
  "link.get": null,
  "workspace.search": null,
}

const NEVER_SNAPSHOT_REASON: Partial<Record<QueryName, string>> = {
  "activity.list": "every command refreshes it",
  "paper.changes":
    "change polling advances its own cursor outside the query cache",
  "paper.head":
    "a tab reads the head once when it opens and then follows the changes feed",
  "paper.export":
    "pinned binary download metadata and exact-basis Word qualification are covered by the package and native Word HTTP replays",
  "coach.status":
    "task snapshots are read with a cursor, outside the query cache",
  "coach.events": "SSE replay advances its own cursor, outside the query cache",
  "job.preview": "reads a posting from the network, not from stored data",
  "link.get": "reads a link from the network, not from stored data",
  "workspace.search": "the web never caches it",
}

const EXEMPT_COMMANDS: Record<string, string> = {
  "account.delete":
    "the person is signed out right after, so a refetch would only answer 401",
}

const PENDING_GAPS: Record<
  string,
  { issue: number; expires: string; reads: QueryName[] }
> = {}

async function arrangedIds(
  db: TestDatabase,
  userId: string,
  touched: string
): Promise<Ids> {
  const owned = async (
    table: typeof jobs | typeof paperDocs | typeof chats | typeof inboxThreads
  ) =>
    (
      await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.userId, userId))
    ).map((row) => row.id)
  const docIds = (await owned(paperDocs)).sort()
  const jobIds = (await owned(jobs)).sort()
  const newestDoc = docIds.at(-1)
  const newestJob = jobIds.at(-1)
  const tokens =
    docIds.length === 0
      ? []
      : (
          await db
            .select({ token: paperShares.token })
            .from(paperShares)
            .where(inArray(paperShares.docId, docIds))
        ).map((row) => row.token)
  const fileIds = (
    await db
      .select({ id: files.id })
      .from(files)
      .where(eq(files.userId, userId))
  ).map((row) => row.id)
  return {
    jobs: jobIds,
    docs: docIds,
    tokens,
    files: fileIds,
    chats: await owned(chats),
    threads: await owned(inboxThreads),
    items:
      jobIds.length === 0
        ? []
        : await db
            .select({ jobId: jobChecklist.jobId, itemId: jobChecklist.id })
            .from(jobChecklist)
            .where(inArray(jobChecklist.jobId, jobIds)),
    touchesPair: (docId, jobId) =>
      touched.includes(docId) ||
      touched.includes(jobId) ||
      (docId === newestDoc && jobId === newestJob),
  }
}

function keyOf(spec: ReadSpec) {
  return `${spec.query} ${JSON.stringify(spec.input)}`
}

function specsFor(ids: Ids): ReadSpec[] {
  return (Object.keys(SNAPSHOT_QUERIES) as QueryName[]).flatMap((query) => {
    const inputs = SNAPSHOT_QUERIES[query]
    if (!inputs) return []
    return inputs(ids).map((input) => ({ query, input }))
  })
}

async function snapshot(
  registry: Registry,
  actor: Actor,
  coach: Actor,
  specs: ReadSpec[]
): Promise<Snapshot> {
  const result: Snapshot = new Map()
  for (const spec of specs) {
    try {
      const output = await registry.read(
        spec.query,
        spec.input,
        spec.asCoach ? coach : actor
      )
      result.set(keyOf(spec), JSON.stringify(output))
    } catch (error) {
      result.set(
        keyOf(spec),
        `ERROR ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  return result
}

function changedBetween(
  specs: ReadSpec[],
  before: Snapshot,
  after: Snapshot
): ReadSpec[] {
  return specs.filter(
    (spec) => before.get(keyOf(spec)) !== after.get(keyOf(spec))
  )
}

function refreshes(refs: QueryRef[], spec: ReadSpec) {
  return refs.some(
    (ref) =>
      ref.query === spec.query &&
      Object.entries(ref.input ?? {}).every(
        ([key, value]) => spec.input[key] === value
      )
  )
}

function invalidatesTable(): InvalidatesTable {
  const adoptedReads = Object.values(catalog).filter(
    (operation) => operation.kind === "read"
  )
  const adoptedRefreshes = (
    touches: { ownerId: string; name: string; entityId?: string }[]
  ) =>
    adoptedReads
      .filter((operation) =>
        operation
          .dependsOn({} as never)
          .some((resource) =>
            touches.some((touch) =>
              resourcesOverlap(touch, { ...resource, ownerId: "owner" })
            )
          )
      )
      .map((operation) => ({ query: operation.name }) as QueryRef)
  return Object.fromEntries(
    Object.values(catalog)
      .filter((operation) => operation.kind === "command")
      .map((operation) => [
        operation.name,
        (input: unknown) => [
          ...adoptedRefreshes(
            (operation.writes as (input?: unknown) => readonly ResourceRef[])(
              operation.name === "paper.import"
                ? undefined
                : operation.input.parse(input)
            ).map((resource) => ({ ...resource, ownerId: "owner" }))
          ),
        ],
      ])
  )
}

function without(
  table: InvalidatesTable,
  command: string,
  query: QueryName
): InvalidatesTable {
  return {
    ...table,
    [command]: (input) =>
      table[command]!(input).filter((ref) => ref.query !== query),
  }
}

function tolerated(command: string, query: QueryName) {
  return PENDING_GAPS[command]?.reads.includes(query) ?? false
}

function unlistedChanges(observations: Observation[], table: InvalidatesTable) {
  return observations.flatMap((observation) => {
    const refs = table[observation.command]
    if (!refs) throw new Error(`no invalidates for ${observation.command}`)
    if (observation.command in EXEMPT_COMMANDS) return []
    const listed = observation.inputs.flatMap((input) => refs(input))
    return observation.changed
      .filter((spec) => !refreshes(listed, spec))
      .map((spec) => ({ observation, spec }))
  })
}

function gapsIn(observations: Observation[], table: InvalidatesTable) {
  const gaps = new Map<string, string>()
  for (const { observation, spec } of unlistedChanges(observations, table)) {
    if (tolerated(observation.command, spec.query)) continue
    const label = `${observation.scenario} changed ${spec.query}`
    if (gaps.has(label)) continue
    gaps.set(
      label,
      `${label} ${JSON.stringify(spec.input)} but its refresh bridge does not cover it. Fix the resource dependencies or legacy invalidates of ${observation.command}.`
    )
  }
  return [...gaps.values()].sort()
}

describe("every changed read is named by the command that changed it", () => {
  const userId = "user-coverage"
  const acts: Observation[] = []
  const undos: Observation[] = []
  const reversals: Observation[] = []
  let controlDiffs: ReadSpec[] = []
  let readCount = 0
  const answered = new Set<QueryName>()
  const asked = new Set<QueryName>()
  let closeDb: () => Promise<void> = async () => {}

  beforeAll(async () => {
    const coach = coachActor(
      userId,
      "11111111-1111-4111-8111-111111111111",
      "invalidation-minted"
    )
    const { db, client } = await createMigratedTestDb()
    closeDb = () => client.close()
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-coverage@example.com",
    })
    let scenario = ""
    let ownCalls = 0
    let undoSeen = 0
    const observe = async (
      registry: Registry,
      person: Actor,
      label: string,
      command: string,
      input: unknown,
      touched: string,
      perform: () => Promise<unknown>
    ) => {
      const specs = specsFor(await arrangedIds(db, userId, touched))
      const before = await snapshot(registry, person, coach, specs)
      const value = await perform()
      const after = await snapshot(registry, person, coach, specs)
      readCount += specs.length
      for (const spec of specs) {
        asked.add(spec.query)
        const answers = [before.get(keyOf(spec)), after.get(keyOf(spec))]
        if (answers.some((answer) => answer && !answer.startsWith("ERROR")))
          answered.add(spec.query)
      }
      return {
        value,
        observation: {
          scenario: label,
          command,
          inputs: [input],
          changed: changedBetween(specs, before, after),
        },
      }
    }
    const { cases, registry, person } = coverageCases(db, userId, {
      run: (inner) => async (name, input) => {
        if (name !== scenario) return inner(name, input)
        ownCalls += 1
        const { value, observation } = await observe(
          currentRegistry(),
          currentPerson(),
          name,
          name,
          input,
          JSON.stringify(input),
          () => inner(name, input)
        )
        acts.push(observation)
        return value as Awaited<ReturnType<typeof inner>>
      },
      undo: (inner, undoRegistry) => async (result) => {
        if (!result.activityId) {
          const plan = result.reversal
          if (!plan) return inner(result)
          const { observation } = await observe(
            undoRegistry,
            currentPerson(),
            `${scenario} reversal`,
            plan.command,
            plan.input,
            JSON.stringify(plan.input),
            () => inner(result)
          )
          reversals.push(observation)
          return
        }
        undoSeen += 1
        const input = { activityId: result.activityId }
        const rows = await db
          .select()
          .from(activity)
          .where(eq(activity.id, result.activityId))
        const touched = JSON.stringify([
          rows[0]?.subjectId,
          rows[0]?.reversalInput,
        ])
        const { observation } = await observe(
          undoRegistry,
          currentPerson(),
          `${scenario} undo`,
          "activity.undo",
          input,
          touched,
          () =>
            undoRegistry.execute({
              name: "activity.undo",
              input,
              actor: currentPerson(),
            })
        )
        undos.push(observation)
      },
    })
    const currentRegistry = () => registry
    const currentPerson = () => person

    await withDatabase(db, async () => {
      for (const row of cases) {
        scenario = row.name
        ownCalls = 0
        await row.arrange()
        ownCalls = 0
        const result = await row.act()
        if (ownCalls === 0) {
          throw new Error(
            `${row.name}: act must run its own command through run()`
          )
        }
        await row.assert(result)
        if (row.undoAssert) await row.undoAssert(result)
      }
      const finalSpecs = specsFor(await arrangedIds(db, userId, ""))
      const first = await snapshot(registry, person, coach, finalSpecs)
      const second = await snapshot(registry, person, coach, finalSpecs)
      controlDiffs = changedBetween(finalSpecs, first, second)
    })
    expect(undoSeen).toBeGreaterThan(0)
  }, 240_000)

  afterAll(async () => {
    vi.unstubAllEnvs()
    await closeDb()
  })

  it("decides every read in queries.ts", () => {
    const decided = Object.keys(SNAPSHOT_QUERIES).sort()
    expect(decided).toEqual(Object.keys(queries).sort())
    for (const [query, inputs] of Object.entries(SNAPSHOT_QUERIES)) {
      if (inputs) continue
      expect(NEVER_SNAPSHOT_REASON[query as QueryName], query).toBeTruthy()
    }
  })

  it("control: reading twice with no command in between changes nothing", () => {
    expect(controlDiffs.map(keyOf)).toEqual([])
  })

  it("every snapshotted read returns a real answer in at least one case", () => {
    expect(readCount).toBeGreaterThan(0)
    const snapshotted = (Object.keys(SNAPSHOT_QUERIES) as QueryName[]).filter(
      (query) => SNAPSHOT_QUERIES[query]
    )
    const neverAsked = snapshotted.filter((query) => !asked.has(query))
    const neverAnswered = snapshotted.filter((query) => !answered.has(query))
    expect({ neverAsked, neverAnswered }).toEqual({
      neverAsked: [],
      neverAnswered: [],
    })
  })

  it("most commands visibly change some read, so the check is not vacuous", () => {
    const moved = acts.filter((entry) => entry.changed.length > 0)
    expect(moved.length).toBeGreaterThan(acts.length * 0.6)
    expect(undos.every((entry) => entry.changed.length > 0)).toBe(true)
  })

  it("R1: every read a command changes is in its invalidates", () => {
    expect(gapsIn([...acts, ...reversals], invalidatesTable())).toEqual([])
  })

  it("R2: an undo changes only reads that activity.undo refreshes", () => {
    expect(gapsIn(undos, invalidatesTable())).toEqual([])
  })

  it("G6: removing a Job bridge edge is caught for legacy writes, adoption and Undo", () => {
    for (const [command, query] of [
      ["job.create", "job.priorityCounts"],
      ["job.update", "job.priorityCounts"],
      ["job.delete", "job.priorityCounts"],
      ["job.setPriority", "job.priorityCounts"],
      ["job.setPriority", "job.get"],
      ["job.setPriority", "job.list"],
      ["activity.undo", "job.priorityCounts"],
    ] as const) {
      const gaps = gapsIn(
        [...acts, ...undos],
        without(invalidatesTable(), command, query)
      )
      expect(
        gaps.some((gap) => gap.includes(`changed ${query}`)),
        `${command} -> ${query}`
      ).toBe(true)
    }
  })

  it("mutant R1: paper.duplicate without paper.list is caught", () => {
    const mutant = without(invalidatesTable(), "paper.duplicate", "paper.list")
    const gaps = gapsIn(acts, mutant)
    expect(gaps.join("\n")).toContain("paper.duplicate changed paper.list")
  })

  it("mutant R2: activity.undo without paper.list is caught", () => {
    const mutant = without(invalidatesTable(), "activity.undo", "paper.list")
    const gaps = gapsIn(undos, mutant)
    expect(gaps.join("\n")).toContain("changed paper.list")
  })

  it("every pending gap still happens, names an issue and has not expired", () => {
    const seen = new Set(
      unlistedChanges(acts, invalidatesTable()).map(
        ({ observation, spec }) => `${observation.command} ${spec.query}`
      )
    )
    for (const [command, entry] of Object.entries(PENDING_GAPS)) {
      expect(entry.issue, command).toBeGreaterThan(0)
      expect(Date.parse(entry.expires), command).toBeGreaterThan(Date.now())
      for (const read of entry.reads) {
        expect(seen.has(`${command} ${read}`), `${command} ${read}`).toBe(true)
      }
    }
  })

  it("every exemption gives a reason and names a bound command", () => {
    for (const [command, reason] of Object.entries(EXEMPT_COMMANDS)) {
      expect(reason.length, command).toBeGreaterThan(10)
      expect(command in catalog, command).toBe(true)
    }
  })
})
