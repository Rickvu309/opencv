import { randomUUID } from "node:crypto"
import { coachWorkerEnabledFromEnv } from "../config.js"
import type { Registry } from "../registry/registry.js"
import { createTaskRuntime } from "./task-runtime.js"
import { COACH_TASK_RUNTIME_VERSION, taskCatalogDigest } from "./task-start.js"
import { runCoachWorker } from "./worker.js"

export function startEmbeddedCoachWorker(
  registry: Registry,
  env: NodeJS.ProcessEnv = process.env
) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = Promise.resolve()
  if (coachWorkerEnabledFromEnv(env)) {
    const workerId = `api-${randomUUID()}`
    const next = () => {
      running = runCoachWorker({
        workerId,
        registry,
        runtime: (task) => createTaskRuntime(task, registry),
        catalogDigest: taskCatalogDigest(registry),
        runtimeVersion: COACH_TASK_RUNTIME_VERSION,
        env,
        leaseMs: env.COACH_RUNTIME === "fake" ? 3000 : 30_000,
      })
        .then(() => undefined)
        .catch((error: unknown) =>
          console.error("[coach] worker failed", error)
        )
        .finally(() => {
          if (!stopped) {
            timer = setTimeout(next, 250)
            timer.unref()
          }
        })
    }
    next()
  }
  return async () => {
    stopped = true
    clearTimeout(timer)
    await running
  }
}
