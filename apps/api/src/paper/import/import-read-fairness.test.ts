import { randomUUID } from "node:crypto"
import { Worker } from "node:worker_threads"

import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { paperDocs, user } from "../../db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "../../test/harness.js"
import { textPdf } from "./import-fixtures.test.js"
import { fanOutPdf } from "./import-hostile-fixtures.test.js"
import { IMPORT_READ_LIMITS } from "./import-limits.js"
import {
  IMPORT_ACCOUNT_BUSY_MESSAGE,
  IMPORT_BUSY_MESSAGE,
  IMPORT_CANCELLED_MESSAGE,
  IMPORT_READER_OFF_MESSAGE,
  LETTER_READER_OFF_MESSAGE,
  importBudgetMessage,
  importReadStop,
} from "./import-parse.js"
import {
  createImportReadQueue,
  ImportReadCancelled,
  ImportReadLimited,
} from "./import-read-queue.js"
import { importReader, workerHeapWatchAvailable } from "./import-text-pool.js"
import { importedPaper } from "./import-word.js"

const SLOW_READ_MS = 10_000

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise((done) => setImmediate(done))

function simulated(overrides: Partial<{ waiting: number }> = {}) {
  let clock = 0
  const queue = createImportReadQueue({
    workers: IMPORT_READ_LIMITS.workers,
    waiting: overrides.waiting ?? IMPORT_READ_LIMITS.waiting,
    waitMs: IMPORT_READ_LIMITS.waitMs,
    budgetMs: IMPORT_READ_LIMITS.accountBudgetMs,
    windowMs: IMPORT_READ_LIMITS.accountWindowMs,
    fairStepMs: IMPORT_READ_LIMITS.fairStepMs,
    accountRetryMs: IMPORT_READ_LIMITS.accountRetryMs,
    serviceRetryMs: IMPORT_READ_LIMITS.serviceRetryMs,
    now: () => clock,
  })
  const running = new Map<string, ReturnType<typeof deferred>>()
  const started: Array<{ owner: string; at: number }> = []
  const read = (owner: string, signal?: AbortSignal) =>
    queue.run(owner, signal, async () => {
      const job = deferred()
      running.set(owner, job)
      started.push({ owner, at: clock })
      await job.promise
      return owner
    })
  const finishRound = async () => {
    clock += SLOW_READ_MS
    const jobs = [...running.values()]
    running.clear()
    for (const job of jobs) job.resolve()
    await flush()
    await flush()
  }
  const attackers: string[] = []
  let stopped = false
  const attack = (owner: string) => {
    attackers.push(owner)
    const again = (): Promise<void> | undefined =>
      stopped
        ? undefined
        : read(owner).then(
            () => again(),
            () => undefined
          )
    void again()
  }
  return {
    queue,
    read,
    finishRound,
    attack,
    started,
    running,
    stop: () => {
      stopped = true
    },
    advance: (ms: number) => {
      clock += ms
    },
    now: () => clock,
  }
}

describe("one account can slow down only itself", () => {
  it("runs one read per account and refuses the rest of 10 and of 50 at once with a plain wait", async () => {
    for (const count of [10, 50]) {
      const sim = simulated()
      const outcomes = await Promise.allSettled(
        Array.from({ length: count }, () => {
          const pending = sim.read("attacker")
          return Promise.race([pending, flush().then(() => "running")])
        })
      )
      const refused = outcomes.filter(
        (outcome) =>
          outcome.status === "rejected" &&
          outcome.reason instanceof ImportReadLimited &&
          outcome.reason.limit === "account-busy"
      )
      expect(refused).toHaveLength(count - 1)
      expect(sim.started).toHaveLength(1)
      const stop = importReadStop(
        (refused[0] as PromiseRejectedResult).reason,
        "import"
      )
      expect(stop).toEqual({
        status: 429,
        code: "IMPORT_READ_LIMITED",
        message: IMPORT_ACCOUNT_BUSY_MESSAGE,
        retryAfterSeconds: 10,
      })
      const honest = sim.read("honest")
      await flush()
      expect(sim.started.map((start) => start.owner)).toEqual([
        "attacker",
        "honest",
      ])
      await sim.finishRound()
      await expect(honest).resolves.toBe("honest")
      expect(sim.queue.state()).toEqual({ running: 0, waiting: 0, owners: 0 })
    }
  })

  it("serves ten fresh attacker accounts' first reads, then the honest read, within five slow reads, and later honest reads within one", async () => {
    const sim = simulated()
    for (let index = 0; index < 10; index += 1) sim.attack(`attacker-${index}`)
    await flush()
    const honest = sim.read("honest")
    await flush()
    while (!sim.started.some((start) => start.owner === "honest"))
      await sim.finishRound()
    const firstWait = sim.started.find((start) => start.owner === "honest")!.at
    expect(firstWait).toBeLessThanOrEqual(5 * SLOW_READ_MS)
    await sim.finishRound()
    await expect(honest).resolves.toBe("honest")
    sim.advance(SLOW_READ_MS / 2)
    const arrived = sim.now()
    const later = sim.read("honest-later")
    await flush()
    while (!sim.started.some((start) => start.owner === "honest-later"))
      await sim.finishRound()
    const laterStart = sim.started.find(
      (start) => start.owner === "honest-later"
    )!.at
    expect(laterStart - arrived).toBeLessThanOrEqual(SLOW_READ_MS)
    await sim.finishRound()
    await expect(later).resolves.toBe("honest-later")
    for (let round = 0; round < 40; round += 1) await sim.finishRound()
    expect(sim.queue.state()).toEqual({ running: 0, waiting: 0, owners: 0 })
    for (let index = 0; index < 10; index += 1) {
      const used = sim.queue.usedMs(`attacker-${index}`)
      expect(used).toBeLessThanOrEqual(
        IMPORT_READ_LIMITS.accountBudgetMs + SLOW_READ_MS
      )
    }
  })

  it("stops an account at its reading budget with the time it frees, and serves other accounts", async () => {
    const sim = simulated()
    const reads = IMPORT_READ_LIMITS.accountBudgetMs / SLOW_READ_MS
    for (let index = 0; index < reads; index += 1) {
      const pending = sim.read("heavy")
      await flush()
      await sim.finishRound()
      await pending
    }
    const refused = await sim.read("heavy").catch((error: unknown) => error)
    expect(refused).toBeInstanceOf(ImportReadLimited)
    const limited = refused as ImportReadLimited
    expect(limited.limit).toBe("account-budget")
    expect(limited.retryAfterSeconds).toBeGreaterThan(50 * 60)
    expect(limited.retryAfterSeconds).toBeLessThanOrEqual(60 * 60)
    expect(importReadStop(limited, "letter")).toMatchObject({
      status: 429,
      message: importBudgetMessage(limited.retryAfterSeconds),
    })
    expect(importBudgetMessage(limited.retryAfterSeconds)).toContain(
      "Try again in 60 minutes."
    )
    const other = sim.read("other")
    await flush()
    await sim.finishRound()
    await expect(other).resolves.toBe("other")
    sim.advance(IMPORT_READ_LIMITS.accountWindowMs)
    const back = sim.read("heavy")
    await flush()
    await sim.finishRound()
    await expect(back).resolves.toBe("heavy")
  })

  it("drops a waiting read when its client leaves and frees the account at once", async () => {
    const sim = simulated()
    const first = sim.read("a")
    const second = sim.read("b")
    const leaving = new AbortController()
    const waiting = sim.read("gone", leaving.signal)
    await flush()
    expect(sim.queue.state()).toEqual({ running: 2, waiting: 1, owners: 3 })
    leaving.abort()
    await expect(waiting).rejects.toBeInstanceOf(ImportReadCancelled)
    expect(sim.queue.state()).toEqual({ running: 2, waiting: 0, owners: 2 })
    await sim.finishRound()
    await Promise.all([first, second])
    expect(sim.started.map((start) => start.owner)).toEqual(["a", "b"])
  })

  it("puts a newcomer ahead of an account that has used more reading time when every waiting place is taken", async () => {
    const sim = simulated({ waiting: 2 })
    sim.attack("a")
    sim.attack("b")
    sim.attack("c")
    sim.attack("d")
    await flush()
    await sim.finishRound()
    const fresh = sim.read("honest")
    await flush()
    expect(sim.queue.state().waiting).toBe(2)
    while (!sim.started.some((start) => start.owner === "honest"))
      await sim.finishRound()
    expect(
      sim.started.find((start) => start.owner === "honest")!.at
    ).toBeLessThanOrEqual(2 * SLOW_READ_MS)
    sim.stop()
    await sim.finishRound()
    await expect(fresh).resolves.toBe("honest")
  })

  it("tells a newcomer the service is busy when every waiting place holds an account with no more reading time used", async () => {
    const sim = simulated({ waiting: 2 })
    for (const owner of ["a", "b", "c", "d"]) void sim.read(owner)
    await flush()
    const refused = await sim.read("honest").catch((error: unknown) => error)
    expect(importReadStop(refused, "import")).toEqual({
      status: 503,
      code: "IMPORT_READ_BUSY",
      message: IMPORT_BUSY_MESSAGE,
      retryAfterSeconds: 60,
    })
    await sim.finishRound()
    await sim.finishRound()
  })
})

describe("the worker pool against a slow PDF", () => {
  it("serves 9 of 9 honest reads while one account keeps 10 slow reads in flight", async () => {
    const slow = fanOutPdf()
    const honestPdf = textPdf("Minh Anh EXPERIENCE Analyst at Example Co")
    let stop = false
    let attackerRefused = 0
    let attackerRead = 0
    const attacker = async () => {
      while (!stop) {
        await importedPaper(
          { name: "slow.pdf", mediaType: "", bytes: slow },
          { owner: "attacker" }
        ).then(
          () => (attackerRead += 1),
          (error: unknown) => {
            if (importReadStop(error, "import")?.status === 429)
              attackerRefused += 1
            else attackerRead += 1
          }
        )
        await new Promise((done) => setTimeout(done, 50))
      }
    }
    const attackers = Array.from({ length: 10 }, () => attacker())
    const honest = await Promise.all(
      Array.from(
        { length: 9 },
        (_, index) =>
          new Promise<{ ok: boolean; ms: number }>((done) => {
            setTimeout(
              () => {
                const start = performance.now()
                void importedPaper(
                  { name: "cv.pdf", mediaType: "", bytes: honestPdf },
                  { owner: `honest-${index}` }
                ).then(
                  () => done({ ok: true, ms: performance.now() - start }),
                  () => done({ ok: false, ms: performance.now() - start })
                )
              },
              500 + index * 4_000
            )
          })
      )
    )
    stop = true
    await Promise.all(attackers)
    expect(honest.filter((read) => read.ok)).toHaveLength(9)
    expect(Math.max(...honest.map((read) => read.ms))).toBeLessThan(5_000)
    expect(attackerRefused).toBeGreaterThan(9)
    expect(attackerRead).toBeGreaterThanOrEqual(3)
    expect(importReader.queue.state()).toEqual({
      running: 0,
      waiting: 0,
      owners: 0,
    })
  }, 90_000)

  it("stops a running read whose client left and frees its worker", async () => {
    const leaving = new AbortController()
    const start = performance.now()
    const read = importedPaper(
      { name: "slow.pdf", mediaType: "", bytes: fanOutPdf() },
      { owner: randomUUID(), signal: leaving.signal }
    )
    setTimeout(() => leaving.abort(), 300)
    await expect(read).rejects.toBeInstanceOf(ImportReadCancelled)
    expect(performance.now() - start).toBeLessThan(2_000)
    expect(importReader.queue.state()).toEqual({
      running: 0,
      waiting: 0,
      owners: 0,
    })
  }, 20_000)
})

describe("the import and Letter routes share one gate", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"]
  let app: ReturnType<typeof createTestApp>
  const people: Array<{ cookie: string; id: string }> = []

  beforeAll(async () => {
    ;({ db, client } = await createMigratedTestDb())
    app = createTestApp(db)
    for (const name of ["first", "second"]) {
      const email = `${name}-reader@example.com`
      const { cookie } = await signUp(app, { name, email })
      const [row] = await db.select().from(user).where(eq(user.email, email))
      people.push({ cookie, id: row!.id })
    }
  })

  afterAll(async () => {
    await client.close()
  })

  afterEach(() => {
    importReader.heapWatch = workerHeapWatchAvailable()
  })

  function upload(
    path: "/api/paper/import" | "/api/paper/letter-attachment",
    cookie: string,
    signal?: AbortSignal
  ) {
    const form = new FormData()
    form.set(
      "file",
      new File(
        [new Uint8Array(textPdf("Minh Anh EXPERIENCE Analyst"))],
        "cv.pdf",
        { type: "application/pdf" }
      )
    )
    return Promise.resolve(
      app.request(
        new Request(`http://localhost${path}`, {
          method: "POST",
          headers: { Origin: testWebOrigin, Cookie: cookie },
          body: form,
          ...(signal ? { signal } : {}),
        })
      )
    )
  }

  async function holding<T>(owner: string, work: () => Promise<T>) {
    const held = deferred()
    const slot = importReader.queue.run(owner, undefined, () => held.promise)
    try {
      return await work()
    } finally {
      held.resolve()
      await slot
    }
  }

  it("tells a person importing a second file while the first is read to wait, then imports it", async () => {
    const [first] = people
    const refused = await holding(first!.id, () =>
      upload("/api/paper/import", first!.cookie)
    )
    expect(refused.status).toBe(429)
    expect(refused.headers.get("retry-after")).toBe("10")
    expect(await refused.json()).toMatchObject({
      error: { message: IMPORT_ACCOUNT_BUSY_MESSAGE },
    })
    const again = await upload("/api/paper/import", first!.cookie)
    expect(again.status).toBe(200)
  })

  it("counts a Letter attachment against the same account's read", async () => {
    const [first, second] = people
    const [mine, theirs] = await holding(first!.id, () =>
      Promise.all([
        upload("/api/paper/letter-attachment", first!.cookie),
        upload("/api/paper/letter-attachment", second!.cookie),
      ])
    )
    expect(mine.status).toBe(429)
    expect(await mine.json()).toMatchObject({
      error: { message: IMPORT_ACCOUNT_BUSY_MESSAGE },
    })
    expect(theirs.status).toBe(200)
  })

  it("answers a busy Letter attachment with the busy message, not a file error", () => {
    expect(
      importReadStop(new ImportReadLimited("service-busy", 60), "letter")
    ).toEqual({
      status: 503,
      code: "IMPORT_READ_BUSY",
      message: IMPORT_BUSY_MESSAGE,
      retryAfterSeconds: 60,
    })
  })

  it("drops a waiting import whose client left and makes no page", async () => {
    const [, second] = people
    const before = await db.select().from(paperDocs)
    const leaving = new AbortController()
    const response = await holding(randomUUID(), () =>
      holding(randomUUID(), async () => {
        const pending = Promise.resolve(
          upload("/api/paper/import", second!.cookie, leaving.signal)
        )
        await new Promise((done) => setTimeout(done, 200))
        expect(importReader.queue.state().waiting).toBe(1)
        leaving.abort()
        return pending
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { message: IMPORT_CANCELLED_MESSAGE },
    })
    expect(await db.select().from(paperDocs)).toHaveLength(before.length)
  })

  it("refuses PDF reading and says so in the health check when the worker memory watch is missing", async () => {
    const [first] = people
    const original = Object.getOwnPropertyDescriptor(
      Worker.prototype,
      "getHeapStatistics"
    )
    expect(original).toBeDefined()
    delete (Worker.prototype as { getHeapStatistics?: unknown })
      .getHeapStatistics
    try {
      expect(workerHeapWatchAvailable()).toBe(false)
      importReader.heapWatch = workerHeapWatchAvailable()
    } finally {
      Object.defineProperty(Worker.prototype, "getHeapStatistics", original!)
    }
    const imported = await upload("/api/paper/import", first!.cookie)
    expect(imported.status).toBe(503)
    expect(await imported.json()).toMatchObject({
      error: { message: IMPORT_READER_OFF_MESSAGE },
    })
    const letter = await upload("/api/paper/letter-attachment", first!.cookie)
    expect(letter.status).toBe(503)
    expect(await letter.json()).toMatchObject({
      error: { message: LETTER_READER_OFF_MESSAGE },
    })
    const health = await app.request("/health")
    expect(await health.json()).toMatchObject({ ok: true, pdfReading: false })
    const form = new FormData()
    form.set("file", new File(["Minh Anh\nAnalyst"], "cv.txt"))
    const text = await app.request("/api/paper/import", {
      method: "POST",
      headers: { Origin: testWebOrigin, Cookie: first!.cookie },
      body: form,
    })
    expect(text.status).toBe(200)
  })
})
