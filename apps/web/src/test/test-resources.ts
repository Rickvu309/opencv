const cleanups = new Set<() => Promise<void>>()

export function registerTestCleanup(cleanup: () => Promise<void>) {
  cleanups.add(cleanup)
}

export async function cleanupTestResources() {
  const errors: unknown[] = []
  for (const cleanup of [...cleanups]) {
    try {
      await cleanup()
      cleanups.delete(cleanup)
    } catch (error) {
      // Retain failed callbacks so another pass can finish their disposal.
      errors.push(error)
    }
  }
  if (errors.length) {
    throw new AggregateError(
      errors,
      `Test resource cleanup failed: ${errors.map(String).join("; ")}`
    )
  }
}

// Sonner 2.0.8 does not retain its insertion/exit timeout handles. Track its
// calls at the scheduling boundary; other libraries need their teardown timers
// (for example Base UI scroll unlocking) to finish normally.
export function registerSonnerTimers() {
  const schedule = globalThis.setTimeout
  const cancel = globalThis.clearTimeout
  const pending = new Set<ReturnType<typeof setTimeout>>()
  const tracked = Object.assign((...args: Parameters<typeof setTimeout>) => {
    const timer = schedule(...args)
    if (new Error().stack?.includes("/sonner/dist/")) pending.add(timer)
    return timer
  }, schedule)
  globalThis.setTimeout = tracked
  return async () => {
    for (const timer of pending) cancel(timer)
    pending.clear()
    if (globalThis.setTimeout === tracked) globalThis.setTimeout = schedule
  }
}
