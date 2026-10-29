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

// Sonner does not retain its insertion/exit timeout handles. A single
// scheduling wrapper avoids adding another frame after each fake-timer test.
const sonnerTimers = new Set<ReturnType<typeof setTimeout>>()
const sonnerPath = /(?:^|[/\\])sonner(?:@[^/\\]+)?[/\\]dist[/\\]/
let trackerInstalled = false

export function installSonnerTimerTracker() {
  if (trackerInstalled) return

  const schedule = globalThis.setTimeout
  const tracked = Object.assign((...args: Parameters<typeof setTimeout>) => {
    const timer = schedule(...args)
    if (sonnerPath.test(new Error().stack ?? "")) sonnerTimers.add(timer)
    return timer
  }, schedule)

  trackerInstalled = true
  globalThis.setTimeout = tracked
}

export async function cleanupSonnerTimers() {
  const cancel = globalThis.clearTimeout
  for (const timer of sonnerTimers) cancel(timer)
  sonnerTimers.clear()
}

export function pendingSonnerTimerCount() {
  return sonnerTimers.size
}
