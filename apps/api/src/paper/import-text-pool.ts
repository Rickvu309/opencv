import { Worker } from "node:worker_threads"

import { IMPORT_READ_LIMITS } from "./import-limits.js"

export type ImportReadReason =
  "pages" | "locked" | "heavy" | "text" | "slow" | "failed"

export class ImportReadRefusal extends Error {
  constructor(readonly reason: ImportReadReason) {
    super(`import-read-${reason}`)
  }
}

export class ImportReadBusy extends Error {
  constructor() {
    super("import-read-busy")
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

const waiting: Array<() => void> = []
let running = 0

function releaseSlot() {
  const next = waiting.shift()
  if (next) next()
  else running -= 1
}

async function takeSlot() {
  if (running < IMPORT_READ_LIMITS.parallel) {
    running += 1
    return
  }
  if (waiting.length >= IMPORT_READ_LIMITS.waiting) throw new ImportReadBusy()
  await new Promise<void>((resolve, reject) => {
    const turn = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      const index = waiting.indexOf(turn)
      if (index !== -1) waiting.splice(index, 1)
      reject(new ImportReadBusy())
    }, IMPORT_READ_LIMITS.waitMs)
    waiting.push(turn)
  })
}

function runWorker(
  kind: "pdf" | "docx",
  source: Uint8Array,
  whole: boolean,
  deadlineMs: number
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
    const finish = (outcome: TextOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearInterval(watch)
      void worker.terminate()
      if (outcome.ok) resolve(outcome.text)
      else reject(new ImportReadRefusal(outcome.reason))
    }
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
}) {
  await takeSlot()
  try {
    return await runWorker(
      input.kind,
      input.bytes,
      input.whole,
      input.deadlineMs
    )
  } finally {
    releaseSlot()
  }
}
