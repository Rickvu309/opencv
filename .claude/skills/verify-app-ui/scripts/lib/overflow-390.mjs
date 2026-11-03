export function spills({ scrollWidth, innerWidth, nodes }) {
  const hits = []
  if (scrollWidth > innerWidth)
    hits.push({ kind: "document", scrollWidth, innerWidth })
  for (const node of nodes ?? []) {
    if (node.overflow !== "visible") continue
    const pastRight = node.right > node.parentRight + 1
    const pastLeft = node.left < node.parentLeft - 1
    if (pastRight || pastLeft) hits.push({ kind: "box", ...node })
  }
  return hits
}

export function judgeRoutes(results, pending, today) {
  const problems = []
  const byId = new Map()
  for (const entry of pending) {
    if (byId.has(entry.id)) problems.push(`${entry.id} is listed twice`)
    byId.set(entry.id, entry)
  }
  const seen = new Set(results.map((result) => result.id))
  for (const entry of pending)
    if (!seen.has(entry.id))
      problems.push(`${entry.id} is pending but was not measured`)
  for (const result of results) {
    const entry = byId.get(result.id)
    const expired = entry ? entry.expires < today : false
    if (result.mark && !result.marked)
      problems.push(`${result.id} did not show the long value`)
    if (result.spills > 0 && !entry)
      problems.push(`${result.id} spills and is not pending`)
    if (result.spills > 0 && expired)
      problems.push(
        `${result.id} is still spilling and its pending entry expired on ${entry.expires}`
      )
    if (result.spills === 0 && entry)
      problems.push(`${result.id} no longer spills. Remove its pending entry`)
  }
  return problems
}
