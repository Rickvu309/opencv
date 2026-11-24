import { afterEach, expect, it, vi } from "vitest"
import { installRegistry } from "../install.js"
import { startEmbeddedCoachWorker } from "./embedded-worker.js"
import { runCoachWorker } from "./worker.js"

vi.mock("./worker.js", () => ({ runCoachWorker: vi.fn() }))
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

it("drains accepted work with new durable admissions switched off", async () => {
  vi.mocked(runCoachWorker).mockResolvedValue(false)
  await startEmbeddedCoachWorker(installRegistry(), { COACH_DURABLE: "off" })()
  expect(runCoachWorker).toHaveBeenCalledTimes(1)
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
  const stop = startEmbeddedCoachWorker(installRegistry(), {})
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
  const stop = startEmbeddedCoachWorker(installRegistry(), {})
  await vi.advanceTimersByTimeAsync(500)
  await stop()
  expect(runCoachWorker).toHaveBeenCalledTimes(3)
  expect(log).toHaveBeenCalledTimes(1)
  log.mockRestore()
})
