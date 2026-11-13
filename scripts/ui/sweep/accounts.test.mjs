import assert from "node:assert/strict"
import test from "node:test"

import { poolPaths } from "../account-pool.mjs"
import { pooled } from "./accounts.mjs"

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
