import { Worker } from "node:worker_threads"

import { IMPORT_READ_LIMITS } from "./import-limits.js"
import {
  createImportReadQueue,
  ImportReadCancelled,
} from "./import-read-queue.js"

export type ImportReadReason =
  "pages" | "locked" | "heavy" | "text" | "slow" | "failed"

export class ImportReadRefusal extends Error {
  constructor(readonly reason: ImportReadReason) {
    super(`import-read-${reason}`)
  }
}

export class ImportReadOff extends Error {
  constructor() {
    super("import-read-off")
  }
}

type TextOutcome =
  { ok: true; text: string } | { ok: false; reason: ImportReadReason }

const workerUrl = new URL(
  import.meta.url.endsWith(".ts")
    ? "./import-text-worker.ts"
    : "./import-text-worker.js",
  import.meta.url
)

export function workerHeapWatchAvailable() {
  return typeof Worker.prototype.getHeapStatistics === "function"
}

export const importReader = {
  heapWatch: workerHeapWatchAvailable(),
  queue: createImportReadQueue({
    workers: IMPORT_READ_LIMITS.workers,
    waiting: IMPORT_READ_LIMITS.waiting,
    waitMs: IMPORT_READ_LIMITS.waitMs,
    budgetMs: IMPORT_READ_LIMITS.accountBudgetMs,
    windowMs: IMPORT_READ_LIMITS.accountWindowMs,
    fairStepMs: IMPORT_READ_LIMITS.fairStepMs,
    accountRetryMs: IMPORT_READ_LIMITS.accountRetryMs,
    serviceRetryMs: IMPORT_READ_LIMITS.serviceRetryMs,
  }),
}

export function importReaderReady() {
  return importReader.heapWatch
}

function runWorker(
  kind: "pdf" | "docx",
  source: Uint8Array,
  whole: boolean,
  deadlineMs: number,
  signal: AbortSignal
) {
  const bytes = new Uint8Array(source)
  const worker = new Worker(workerUrl, {
    workerData: { kind, bytes, whole, limits: IMPORT_READ_LIMITS },
    transferList: [bytes.buffer],
    execArgv: [],
    resourceLimits: {
      maxOldGenerationSizeMb: IMPORT_READ_LIMITS.workerHeapMb,
      maxYoungGenerationSizeMb: IMPORT_READ_LIMITS.workerYoungMb,
      stackSizeMb: IMPORT_READ_LIMITS.workerStackMb,
    },
  })
  return new Promise<string>((resolve, reject) => {
    let settled = false
    let measuring = false
    const finish = (outcome: TextOutcome | "cancelled") => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearInterval(watch)
      signal.removeEventListener("abort", cancel)
      void worker
        .terminate()
        .catch(() => 0)
        .then(() => {
          if (outcome === "cancelled") reject(new ImportReadCancelled())
          else if (outcome.ok) resolve(outcome.text)
          else reject(new ImportReadRefusal(outcome.reason))
        })
    }
    const cancel = () => finish("cancelled")
    signal.addEventListener("abort", cancel, { once: true })
    if (signal.aborted) cancel()
    const deadline = setTimeout(
      () => finish({ ok: false, reason: "slow" }),
      deadlineMs
    )
    const watch = setInterval(() => {
      if (measuring || settled) return
      measuring = true
      worker
        .getHeapStatistics()
        .then((heap) => {
          measuring = false
          if (
            heap.used_heap_size + heap.external_memory >
            IMPORT_READ_LIMITS.workerMemoryBytes
          )
            finish({ ok: false, reason: "heavy" })
        })
        .catch(() => {
          measuring = false
        })
    }, IMPORT_READ_LIMITS.memoryCheckMs)
    worker.once("message", (outcome: TextOutcome) => finish(outcome))
    worker.once("error", (error: Error & { code?: string }) =>
      finish({
        ok: false,
        reason: error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "heavy" : "failed",
      })
    )
    worker.once("exit", () => finish({ ok: false, reason: "failed" }))
  })
}

export async function readImportText(input: {
  kind: "pdf" | "docx"
  bytes: Uint8Array
  whole: boolean
  deadlineMs: number
  owner: string
  signal?: AbortSignal
}) {
  if (!importReaderReady()) throw new ImportReadOff()
  return importReader.queue.run(input.owner, input.signal, (signal) =>
    runWorker(input.kind, input.bytes, input.whole, input.deadlineMs, signal)
  )
}
