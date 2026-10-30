// A fact set where some kinds are read only when a row asks for them. The
// kind is present for decide(), which checks `kind in facts`; the read runs on
// first access and is kept. A stop row earlier in the table (a closed issue)
// ends the decision before a fallible read ever happens.
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
