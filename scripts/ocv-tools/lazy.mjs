export function lazyFacts(base, loaders) {
  const facts = { ...base }
  for (const [kind, load] of Object.entries(loaders)) {
    let done = false
    let value
    Object.defineProperty(facts, kind, {
      enumerable: true,
      get() {
        if (!done) {
          value = load()
          done = true
        }
        return value
      },
    })
  }
  return facts
}
