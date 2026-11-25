import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  watch,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

export const POOL_TARGET = 40
export const SIGN_IN_GAP_MS = 3_400
export const TAKE_DEADLINE_MS = 180_000

export const EMPTY_POOL_LINE =
  "account pool is empty: waiting for the background filler's next account (sign-in allows 3 per minute)"

export function poolPaths(dir) {
  const root = join(dir, "pool")
  return {
    root,
    ready: join(root, "ready"),
    taken: join(root, "taken"),
    used: join(root, "used"),
    log: join(root, "filler.log"),
  }
}

const seqText = (seq) => String(seq).padStart(5, "0")

export const poolEmail = (seq) => `ui-pool-${seqText(seq)}@example.com`

export const SHOWN_EMAIL = poolEmail(0)

export const entryName = (seq) => `${seqText(seq)}.json`

export function nextSeq(names) {
  const seqs = names
    .map((name) => Number.parseInt(name, 10))
    .filter(Number.isFinite)
  return seqs.length ? Math.max(...seqs) + 1 : 1
}

export const readyNames = (store, paths) =>
  store
    .list(paths.ready)
    .filter((name) => name.endsWith(".json"))
    .sort()

export function countOf(data) {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === "object")
    return Object.values(data)
      .filter(Array.isArray)
      .reduce((sum, list) => sum + list.length, 0)
  return 0
}

export const LIBRARY_READS = {
  documents: "/api/paper",
  jobs: "/api/jobs",
  chats: "/api/chats",
}

export function libraryFrom(bodies) {
  return Object.fromEntries(
    Object.keys(LIBRARY_READS).map((kind) => [
      kind,
      countOf(bodies[kind]?.data ?? bodies[kind]),
    ])
  )
}

export function untouchedProblem(account, now) {
  const changed = Object.keys(LIBRARY_READS).filter(
    (kind) => account.library?.[kind] !== now[kind]
  )
  if (!changed.length) return null
  return `account ${account.email} is not in its created state: ${changed
    .map((kind) => `${kind} ${account.library?.[kind]} -> ${now[kind]}`)
    .join(", ")}`
}

export function markUsed(store, paths, account, screenId) {
  const mark = join(paths.used, account.email)
  if (store.claim(mark, screenId)) return
  throw new Error(
    `${screenId}: account ${account.email} was already used by ${store.read(mark)}; each recipe needs an unused account from the pool`
  )
}

export async function takeAccount(
  store,
  paths,
  {
    fillerAlive = () => true,
    onEmpty = () => {},
    deadlineMs = TAKE_DEADLINE_MS,
  } = {}
) {
  const until = store.now() + deadlineMs
  let told = false
  for (;;) {
    const change = store.nextChange(paths.ready)
    for (const name of readyNames(store, paths)) {
      const taken = join(paths.taken, name)
      if (!store.rename(join(paths.ready, name), taken)) continue
      change.close()
      return JSON.parse(store.read(taken))
    }
    if (!fillerAlive()) {
      change.close()
      throw new Error(
        `the account pool filler is not running (log ${paths.log}); run node scripts/ui.mjs up again`
      )
    }
    if (!told) onEmpty(EMPTY_POOL_LINE)
    told = true
    const left = until - store.now()
    const changed = left > 0 && (await change.within(left))
    change.close()
    if (!changed)
      throw new Error(
        `no pool account within ${deadlineMs / 1000}s (log ${paths.log})`
      )
  }
}

export function realPoolStore() {
  return {
    now: () => Date.now(),
    list: (dir) => (existsSync(dir) ? readdirSync(dir) : []),
    read: (path) => readFileSync(path, "utf8"),
    write: (path, data) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, data)
    },
    rename: (from, to) => {
      mkdirSync(dirname(to), { recursive: true })
      try {
        renameSync(from, to)
        return true
      } catch (error) {
        if (error.code === "ENOENT") return false
        throw error
      }
    },
    claim: (path, data) => {
      mkdirSync(dirname(path), { recursive: true })
      try {
        writeFileSync(path, data, { flag: "wx" })
        return true
      } catch (error) {
        if (error.code === "EEXIST") return false
        throw error
      }
    },
    nextChange: (dir) => {
      mkdirSync(dir, { recursive: true })
      let settle = () => {}
      const happened = new Promise((resolve) => {
        settle = resolve
      })
      const watcher = watch(dir, () => settle(true))
      let timer = null
      return {
        within: (ms) => {
          timer = setTimeout(() => settle(false), ms)
          return happened
        },
        close: () => {
          clearTimeout(timer)
          watcher.close()
        },
      }
    },
  }
}

export function processAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
