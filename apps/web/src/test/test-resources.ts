const cleanups = new Set<() => Promise<void>>()

export function registerTestCleanup(cleanup: () => Promise<void>) {
  cleanups.add(cleanup)
}

export async function cleanupTestResources() {
  for (const cleanup of cleanups) {
    cleanups.delete(cleanup)
    await cleanup()
  }
}
