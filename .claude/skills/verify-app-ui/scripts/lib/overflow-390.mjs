export function offScreen(rect, innerWidth) {
  if (rect.width < 1 || rect.height < 1) return true
  if (rect.right < 0 || rect.left > innerWidth) return true
  return false
}

export function spills({ scrollWidth, innerWidth, nodes }) {
  const hits = []
  if (scrollWidth > innerWidth)
    hits.push({ kind: "document", scrollWidth, innerWidth })
  for (const node of nodes ?? []) {
    if (node.overflow !== "visible") continue
    if (node.parentOverflow && node.parentOverflow !== "visible") continue
    const pastRight = node.right > node.parentRight + 1
    const pastLeft = node.left < node.parentLeft - 1
    if (pastRight || pastLeft) hits.push({ kind: "box", ...node })
  }
  return hits
}

export function sameSpill(hit, entry) {
  return (
    hit.kind !== "document" &&
    hit.selector === entry.selector &&
    String(hit.text ?? "").startsWith(entry.text)
  )
}

export const badFixture = [
  {
    name: "a page wider than the phone",
    fails: () =>
      spills({ scrollWidth: 500, innerWidth: 390, nodes: [] }).length > 0,
  },
]

export function judgeRoutes(results, pending, today) {
  const problems = []
  const seen = new Set()
  for (const entry of pending) {
    const key = `${entry.route}\0${entry.selector}\0${entry.text}`
    if (!entry.selector || !entry.text)
      problems.push(`${entry.route} pending entry names no element`)
    if (seen.has(key))
      problems.push(`${entry.route} ${entry.selector} is listed twice`)
    seen.add(key)
  }
  const measured = new Set(results.map((result) => result.id))
  for (const entry of pending)
    if (!measured.has(entry.route))
      problems.push(`${entry.route} is pending but was not measured`)
  for (const result of results) {
    if (result.needle && !result.marked)
      problems.push(`${result.id} did not show the long value`)
    const hits = result.hits ?? []
    const entries = pending.filter((entry) => entry.route === result.id)
    for (const hit of hits) {
      if (hit.kind === "document") {
        problems.push(`${result.id} is wider than the phone and is not pending`)
        continue
      }
      if (!entries.some((entry) => sameSpill(hit, entry)))
        problems.push(`${result.id} ${hit.selector} spills and is not pending`)
    }
    for (const entry of entries) {
      const matched = hits.some((hit) => sameSpill(hit, entry))
      if (matched && entry.expires < today)
        problems.push(
          `${result.id} ${entry.selector} is still spilling and its pending entry expired on ${entry.expires}`
        )
      if (!matched)
        problems.push(
          `${result.id} ${entry.selector} no longer spills. Remove its pending entry`
        )
    }
  }
  return problems
}
