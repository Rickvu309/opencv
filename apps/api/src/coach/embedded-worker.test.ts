import { afterEach, expect, it, vi } from "vitest"
import { installRegistry } from "../registry/install.js"
import { startEmbeddedCoachWorker } from "./embedded-worker.js"
import { runCoachWorker } from "./worker.js"

vi.mock("./worker.js", () => ({ runCoachWorker: vi.fn() }))
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

it("leaves the embedded worker disabled outside rollout and supports an independent worker opt out", async () => {
  const registry = installRegistry()
  await startEmbeddedCoachWorker(registry, {})()
  await startEmbeddedCoachWorker(registry, {
    COACH_TASK_WORKER: "internal",
    COACH_EMBEDDED_WORKER: "off",
  })()
  expect(runCoachWorker).not.toHaveBeenCalled()
})

it("runs one claim at a time and drains it before stopping", async () => {
  vi.useFakeTimers()
  let release!: (value: boolean) => void
  vi.mocked(runCoachWorker).mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve
      })
  )
  const stop = startEmbeddedCoachWorker(installRegistry(), {
    COACH_TASK_WORKER: "internal",
  })
  await vi.advanceTimersByTimeAsync(10000)
  expect(runCoachWorker).toHaveBeenCalledTimes(1)
  expect(runCoachWorker).toHaveBeenCalledWith(
    expect.objectContaining({ runtimeVersion: 1, leaseMs: 30000 })
  )
  let drained = false
  const finished = stop().then(() => {
    drained = true
  })
  expect(drained).toBe(false)
  release(true)
  await finished
  await vi.runAllTimersAsync()
  expect(drained).toBe(true)
  expect(runCoachWorker).toHaveBeenCalledTimes(1)
})

it("continues claiming after an idle result or a failed claim", async () => {
  vi.useFakeTimers()
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(runCoachWorker)
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error("connection lost"))
    .mockResolvedValue(false)
  const stop = startEmbeddedCoachWorker(installRegistry(), {
    COACH_TASK_WORKER: "internal",
  })
  await vi.advanceTimersByTimeAsync(500)
  await stop()
  expect(runCoachWorker).toHaveBeenCalledTimes(3)
  expect(log).toHaveBeenCalledTimes(1)
  log.mockRestore()
})
