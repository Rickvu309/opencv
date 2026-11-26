export type ImportReadLimit = "account-busy" | "account-budget" | "service-busy"

export class ImportReadLimited extends Error {
  constructor(
    readonly limit: ImportReadLimit,
    readonly retryAfterSeconds: number
  ) {
    super(`import-read-${limit}`)
  }
}

export class ImportReadCancelled extends Error {
  constructor() {
    super("import-read-cancelled")
  }
}

export type ImportReadQueueOptions = {
  workers: number
  waiting: number
  waitMs: number
  budgetMs: number
  windowMs: number
  fairStepMs: number
  accountRetryMs: number
  serviceRetryMs: number
  now?: () => number
}

type Charge = { at: number; ms: number }

type Waiter = {
  owner: string
  order: number
  start: () => void
  fail: (error: Error) => void
}

export type ImportReadQueue = {
  run: <T>(
    owner: string,
    signal: AbortSignal | undefined,
    job: (signal: AbortSignal) => Promise<T>
  ) => Promise<T>
  usedMs: (owner: string) => number
  state: () => { running: number; waiting: number; owners: number }
}

function seconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000))
}

export function createImportReadQueue(
  options: ImportReadQueueOptions
): ImportReadQueue {
  const now = options.now ?? (() => Date.now())
  const owners = new Set<string>()
  const charges = new Map<string, Charge[]>()
  const waiters: Waiter[] = []
  let running = 0
  let arrivals = 0

  function recent(owner: string) {
    const list = charges.get(owner)
    if (!list) return []
    const since = now() - options.windowMs
    while (list.length > 0 && list[0]!.at <= since) list.shift()
    if (list.length === 0) charges.delete(owner)
    return list
  }

  function usedMs(owner: string) {
    return recent(owner).reduce((total, charge) => total + charge.ms, 0)
  }

  function budgetFreesInMs(owner: string) {
    let used = usedMs(owner)
    for (const charge of recent(owner)) {
      used -= charge.ms
      if (used < options.budgetMs) return charge.at + options.windowMs - now()
    }
    return options.windowMs
  }

  function rank(waiter: Waiter) {
    return Math.floor(usedMs(waiter.owner) / options.fairStepMs)
  }

  function before(a: Waiter, b: Waiter) {
    const byUse = rank(a) - rank(b)
    return byUse !== 0 ? byUse < 0 : a.order < b.order
  }

  function nextIndex() {
    let best = 0
    for (let index = 1; index < waiters.length; index += 1)
      if (before(waiters[index]!, waiters[best]!)) best = index
    return best
  }

  function lastIndex() {
    let worst = 0
    for (let index = 1; index < waiters.length; index += 1)
      if (before(waiters[worst]!, waiters[index]!)) worst = index
    return worst
  }

  function pump() {
    while (running < options.workers && waiters.length > 0) {
      const [waiter] = waiters.splice(nextIndex(), 1)
      running += 1
      waiter!.start()
    }
  }

  function serviceBusy() {
    return new ImportReadLimited(
      "service-busy",
      seconds(options.serviceRetryMs)
    )
  }

  function admit(owner: string, signal: AbortSignal | undefined) {
    if (running < options.workers && waiters.length === 0) {
      running += 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        owner,
        order: (arrivals += 1),
        start: () => {
          settle()
          resolve()
        },
        fail: (error) => {
          settle()
          reject(error)
        },
      }
      const timer = setTimeout(() => {
        const index = waiters.indexOf(waiter)
        if (index !== -1) waiters.splice(index, 1)
        waiter.fail(serviceBusy())
      }, options.waitMs)
      const onAbort = () => {
        const index = waiters.indexOf(waiter)
        if (index !== -1) waiters.splice(index, 1)
        waiter.fail(new ImportReadCancelled())
      }
      const settle = () => {
        clearTimeout(timer)
        signal?.removeEventListener("abort", onAbort)
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      if (waiters.length >= options.waiting) {
        const worst = lastIndex()
        if (!before(waiter, waiters[worst]!)) {
          waiter.fail(serviceBusy())
          return
        }
        const [evicted] = waiters.splice(worst, 1)
        evicted!.fail(serviceBusy())
      }
      waiters.push(waiter)
    })
  }

  async function run<T>(
    owner: string,
    signal: AbortSignal | undefined,
    job: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (signal?.aborted) throw new ImportReadCancelled()
    if (owners.has(owner))
      throw new ImportReadLimited(
        "account-busy",
        seconds(options.accountRetryMs)
      )
    if (usedMs(owner) >= options.budgetMs)
      throw new ImportReadLimited(
        "account-budget",
        seconds(budgetFreesInMs(owner))
      )
    owners.add(owner)
    try {
      await admit(owner, signal)
    } catch (error) {
      owners.delete(owner)
      throw error
    }
    const stop = new AbortController()
    const onAbort = () => stop.abort()
    signal?.addEventListener("abort", onAbort, { once: true })
    const startedAt = now()
    try {
      if (signal?.aborted) throw new ImportReadCancelled()
      return await job(stop.signal)
    } finally {
      signal?.removeEventListener("abort", onAbort)
      const list = charges.get(owner) ?? []
      list.push({ at: now(), ms: Math.max(0, now() - startedAt) })
      charges.set(owner, list)
      owners.delete(owner)
      running -= 1
      pump()
    }
  }

  return {
    run,
    usedMs,
    state: () => ({
      running,
      waiting: waiters.length,
      owners: owners.size,
    }),
  }
}
