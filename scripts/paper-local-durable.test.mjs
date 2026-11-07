import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detectDelayedRecovery,
  detectRequestDurability as detect,
} from "./lib/paper-local-durable.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const INTRODUCED = "a1831b78801edfac3063a7376dc46a72a08fa054"

const delayMistake = `
const PERSIST_MS = 50
const persistSoon = () => {
  persist = timers.setTimeout(() => void save(), PERSIST_MS)
}
client.subscribe((change) => {
  persistSoon()
})
`

const delayClean = `
client.subscribe((change) => {
  void save()
  if (change === "local") schedule()
})
const schedule = () => {
  debounce = timers.setTimeout(() => {
    void run()
  }, DEBOUNCE_MS)
}
`

const requestMistake = `
function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result)
    source.onerror = () => reject(source.error)
  })
}
const store = {
  async save(docId: string, tabId: string, stored: Stored) {
    await request((await table("readwrite")).put(record))
  },
}
`

const requestClean = `
function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result)
    source.onerror = () => reject(source.error)
  })
}
function settled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}
const store = {
  async save(docId: string, tabId: string, stored: Stored) {
    const owned = await table("readwrite")
    owned.put(record)
    await settled(owned.transaction)
  },
  async load(docId: string, tabId: string) {
    await request((await table("readonly")).getAll(range))
  },
}
`

function show(file) {
  return execFileSync("git", ["show", `${INTRODUCED}:${file}`], {
    cwd: root,
    encoding: "utf8",
  })
}

test("a timer in front of the first recovery save fires, and a direct save stays quiet", () => {
  assert.equal(detectDelayedRecovery(delayMistake).length, 2)
  assert.deepEqual(detectDelayedRecovery(delayClean), [])
  assert.ok(
    detectDelayedRecovery(show("apps/web/src/lib/paper-sync.ts")).length > 0
  )
  assert.deepEqual(
    detectDelayedRecovery(
      readFileSync(path.join(root, "apps/web/src/lib/paper-sync.ts"), "utf8")
    ),
    []
  )
})

test("request success used as a durable save fires, and transaction complete stays quiet", () => {
  assert.equal(detect(requestMistake).length, 1)
  assert.deepEqual(detect(requestClean), [])
  assert.ok(detect(show("apps/web/src/lib/paper-sync-store.ts")).length > 0)
  assert.deepEqual(
    detect(
      readFileSync(
        path.join(root, "apps/web/src/lib/paper-sync-store.ts"),
        "utf8"
      )
    ),
    []
  )
})
