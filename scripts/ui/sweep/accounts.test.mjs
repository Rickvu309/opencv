import assert from "node:assert/strict"
import test from "node:test"

import { poolPaths } from "../account-pool.mjs"
import { seededPaths } from "../stack.mjs"
import { accountSource, pooled, seeded } from "./accounts.mjs"

function memoryStore(files) {
  const live = new Map(Object.entries(files))
  return {
    live,
    now: () => 0,
    list: (dir) =>
      [...live.keys()]
        .filter((path) => path.startsWith(`${dir}/`))
        .map((path) => path.slice(dir.length + 1)),
    read: (path) => live.get(path),
    write: (path, data) => live.set(path, data),
    rename: (from, to) => {
      if (!live.has(from)) return false
      live.set(to, live.get(from))
      live.delete(from)
      return true
    },
    claim: (path, data) => {
      if (live.has(path)) return false
      live.set(path, data)
      return true
    },
    nextChange: () => ({ within: async () => false, close: () => {} }),
  }
}

test("the pooled source hands each purpose its own unused account and records who used it", async () => {
  const state = { dir: "/s", pool: { pid: process.pid } }
  const paths = poolPaths(state.dir)
  const account = (seq) =>
    JSON.stringify({
      email: `ui-pool-0000${seq}@example.com`,
      cookies: [{ name: "session", value: `v${seq}` }],
      library: {},
    })
  const store = memoryStore({
    [`${paths.ready}/00001.json`]: account(1),
    [`${paths.ready}/00002.json`]: account(2),
  })
  const source = pooled(state, { store, say: () => {} })
  const first = await source.take("paper-home")
  const second = await source.take("loop cv-formatted.docx")
  assert.deepEqual(first, {
    email: "ui-pool-00001@example.com",
    cookies: [{ name: "session", value: "v1" }],
  })
  assert.equal(second.email, "ui-pool-00002@example.com")
  assert.equal(
    store.live.get(`${paths.used}/ui-pool-00001@example.com`),
    "paper-home"
  )
  await assert.rejects(source.take("third"), /no pool account within/)
})

const seededEntry = (seq) =>
  JSON.stringify({
    email: `ui-seed-0000${seq}@example.com`,
    setCookie: [
      `better-auth.session_token=t${seq}.sig; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`,
    ],
  })

test("the seeded source hands each purpose its own seeded account as browser cookies, without waiting", async () => {
  const state = { dir: "/s", seeded: { count: 2, dir: "/s/seeded" } }
  const paths = seededPaths(state.dir)
  const store = memoryStore({
    [`${paths.ready}/00002.json`]: seededEntry(2),
    [`${paths.ready}/00001.json`]: seededEntry(1),
  })
  const source = seeded(state, { store })
  const first = await source.take("paper-home")
  const second = await source.take("loop cv-text.pdf")
  assert.equal(first.email, "ui-seed-00001@example.com")
  assert.deepEqual(first.cookies, [
    {
      name: "better-auth.session_token",
      value: "t1.sig",
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ])
  assert.equal(second.email, "ui-seed-00002@example.com")
  assert.equal(
    store.live.get(`${paths.used}/ui-seed-00002@example.com`),
    "loop cv-text.pdf"
  )
  await assert.rejects(
    source.take("third"),
    /third: all 2 seeded accounts of this app are used; run node scripts\/ui\.mjs down, then up/
  )
})

test("an app started before seeding says how to get seeded accounts", async () => {
  const source = seeded({ dir: "/s" }, { store: memoryStore({}) })
  await assert.rejects(
    source.take("paper-home"),
    /this app was started without seeded accounts/
  )
})

test("a seeded account taken twice is refused, so two sweeps of one app never share an account", async () => {
  const state = { dir: "/s", seeded: { count: 1, dir: "/s/seeded" } }
  const paths = seededPaths(state.dir)
  const store = memoryStore({
    [`${paths.ready}/00001.json`]: seededEntry(1),
    [`${paths.used}/ui-seed-00001@example.com`]: "paper-home",
  })
  await assert.rejects(
    seeded(state, { store }).take("settings"),
    /settings: account ui-seed-00001@example.com was already used by paper-home/
  )
})

test("the account source is chosen by name and an unknown name is refused", () => {
  const state = { dir: "/s" }
  assert.equal(typeof accountSource("seeded", state).take, "function")
  assert.equal(typeof accountSource("pooled", state).take, "function")
  assert.throws(
    () => accountSource("shared", state),
    /--accounts takes seeded or pooled, got shared/
  )
})
