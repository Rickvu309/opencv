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
