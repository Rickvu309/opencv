import { afterEach, expect, it, vi } from "vitest"
import { idleUntilAbort } from "./sse.js"

afterEach(() => {
  vi.useRealTimers()
})

it("waits through many idle ticks while listening for the abort only once", async () => {
  vi.useFakeTimers()
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  const then = vi.spyOn(promise, "then")
  const idle = idleUntilAbort({ promise })
  for (let tick = 0; tick < 50; tick++) {
    const waiting = idle(250)
    await vi.advanceTimersByTimeAsync(250)
    await waiting
  }
  expect(then).toHaveBeenCalledTimes(1)
  const pending = idle(60_000)
  release()
  await pending
  await idle(60_000)
})
