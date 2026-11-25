import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  detect,
  libraryProblems,
  libraryReads,
} from "../lib/ui-library-reads.mjs"
import {
  EMPTY_POOL_LINE,
  LIBRARY_READS,
  SHOWN_EMAIL,
  entryName,
  libraryFrom,
  markUsed,
  nextSeq,
  poolEmail,
  poolPaths,
  takeAccount,
  untouchedProblem,
} from "./account-pool.mjs"

const EMPTY = { documents: 0, jobs: 0, chats: 0 }

function memoryStore() {
  const files = new Map()
  const waiters = new Set()
  const parent = (path) => path.slice(0, path.lastIndexOf("/"))
  const touched = (path) => {
    for (const waiter of waiters) if (waiter.dir === parent(path)) waiter.wake()
  }
  return {
    files,
    now: () => 0,
    list: (dir) =>
      [...files.keys()]
        .filter((key) => parent(key) === dir)
        .map((key) => key.slice(dir.length + 1)),
    read: (path) => files.get(path),
    write: (path, data) => {
      files.set(path, data)
      touched(path)
    },
    rename: (from, to) => {
      if (!files.has(from)) return false
      files.set(to, files.get(from))
      files.delete(from)
      touched(from)
      touched(to)
      return true
    },
    claim: (path, data) => {
      if (files.has(path)) return false
      files.set(path, data)
      return true
    },
    nextChange: (dir) => {
      let wake = () => {}
      const happened = new Promise((resolve) => {
        wake = () => resolve(true)
      })
      const waiter = { dir, wake }
      waiters.add(waiter)
      return {
        within: () => happened,
        close: () => waiters.delete(waiter),
      }
    },
  }
}

const paths = poolPaths("/scratch/demo")

const addReady = (store, seq, library = EMPTY) =>
  store.write(
    `${paths.ready}/${entryName(seq)}`,
    JSON.stringify({ email: poolEmail(seq), cookies: [], library })
  )

test("the pool hands out distinct accounts and never the same one twice", async () => {
  const store = memoryStore()
  for (const seq of [1, 2, 3]) addReady(store, seq)
  const taken = []
  for (let at = 0; at < 3; at += 1)
    taken.push((await takeAccount(store, paths)).email)
  assert.deepEqual(taken, [poolEmail(1), poolEmail(2), poolEmail(3)])
  assert.equal(new Set(taken).size, 3)
  assert.deepEqual(store.list(paths.ready), [])
  assert.equal(store.list(paths.taken).length, 3)
})

test("an empty pool says why it waits and takes the next account the filler adds", async () => {
  const store = memoryStore()
  addReady(store, 1)
  await takeAccount(store, paths)
  const said = []
  const waiting = takeAccount(store, paths, {
    onEmpty: (line) => said.push(line),
  })
  await Promise.resolve()
  assert.deepEqual(said, [EMPTY_POOL_LINE])
  addReady(store, 2)
  assert.equal((await waiting).email, poolEmail(2))
})

test("an empty pool with no filler running fails at once instead of waiting", async () => {
  const store = memoryStore()
  await assert.rejects(
    takeAccount(store, paths, { fillerAlive: () => false }),
    /account pool filler is not running/
  )
})

test("the filler numbers new accounts after every account it already made", () => {
  assert.equal(nextSeq([]), 1)
  assert.equal(nextSeq([entryName(3), entryName(7), "00009.json.staged"]), 10)
  assert.match(poolEmail(12), /^ui-pool-00012@example\.com$/)
  assert.equal(poolEmail(1).length, poolEmail(99_999).length)
})

test("every pool account is shown under one address of the same length, so shots of different accounts match", () => {
  assert.equal(SHOWN_EMAIL.length, poolEmail(1).length)
  assert.equal(SHOWN_EMAIL.length, poolEmail(4_321).length)
  assert.notEqual(SHOWN_EMAIL, poolEmail(nextSeq([])))
})

test("a recipe that reuses a used account fails", () => {
  const store = memoryStore()
  const account = { email: poolEmail(4) }
  markUsed(store, paths, account, "paper-home")
  assert.throws(
    () => markUsed(store, paths, account, "apply-board"),
    /apply-board: account ui-pool-00004@example\.com was already used by paper-home/
  )
  assert.doesNotThrow(() =>
    markUsed(store, paths, { email: poolEmail(5) }, "apply-board")
  )
})

test("a taken account must still hold the library it was created with", () => {
  const account = { email: poolEmail(6), library: EMPTY }
  const empty = libraryFrom({
    documents: { ok: true, data: [] },
    jobs: { ok: true, data: { jobs: [] } },
    chats: { ok: true, data: [] },
  })
  assert.deepEqual(empty, EMPTY)
  assert.equal(untouchedProblem(account, empty), null)
  const used = libraryFrom({
    documents: { data: [{ id: "a" }, { id: "b" }] },
    jobs: { data: { jobs: [{ id: "j" }] } },
    chats: { data: [] },
  })
  assert.match(
    untouchedProblem(account, used),
    /not in its created state: documents 0 -> 2, jobs 0 -> 1/
  )
})

const rateLimitRetry = (source) =>
  /\b429\b|retry-after|retryAfter|postWithinLimit/i.test(source)

test("no file on a check's path retries on the sign-in limit", () => {
  const firstFix = readFileSync(
    new URL("./fixtures/rate-limit-retry.txt", import.meta.url),
    "utf8"
  )
  assert.equal(rateLimitRetry(firstFix), true)
  for (const file of ["capture.mjs", "fresh-account.mjs", "account-pool.mjs"])
    assert.equal(
      rateLimitRetry(
        readFileSync(new URL(`./${file}`, import.meta.url), "utf8")
      ),
      false,
      file
    )
})

const POOL = readFileSync(
  new URL("./account-pool.mjs", import.meta.url),
  "utf8"
)

test("every library read is a catalog read or a route still waiting to become one", () => {
  assert.deepEqual(libraryReads(POOL), LIBRARY_READS)
  assert.deepEqual(detect(POOL), [])
})

test("a library read of a deleted route or an unknown read fires", () => {
  const facts = {
    waiting: ["GET /api/paper"],
    catalog: ["job.list", "chat.list"],
  }
  assert.deepEqual(
    libraryProblems(
      {
        documents: { path: "/api/paper" },
        jobs: { path: "/api/jobs" },
        chats: { path: "/api/reads/chat.nope", body: "{}" },
      },
      facts
    ),
    [
      "jobs: GET /api/jobs is not served: read it through /api/reads/<name>",
      "chats: /api/reads/chat.nope is not a catalog read sent with a body",
    ]
  )
  assert.deepEqual(
    libraryReads('export const LIBRARY_READS = {\n  jobs: "/api/jobs",\n}'),
    { jobs: { path: "/api/jobs" } }
  )
})
