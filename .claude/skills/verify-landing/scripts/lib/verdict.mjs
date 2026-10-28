// The result shape shared by the landing checks. STALE means the check could not run a part of itself because
// an anchor it needs (a container, a probe) was missing. A missing object the property is about is a FAIL.
export const verdict = (id, name, rule, pass, measured) => ({
  id,
  name,
  rule,
  status: pass ? "PASS" : "FAIL",
  measured,
})
export const stale = (id, name, why, rule) => ({
  id,
  name,
  rule,
  status: "STALE",
  measured: why,
})
// Wraps a verdict: a reason means the check could not locate what it measures.
export const staleIf = (why, v) => (why ? stale(v.id, v.name, why, v.rule) : v)

// A check with several parts. A judged part that breaks the rule is a FAIL even when another part could not be
// located; with none broken, a part it could not locate makes it STALE; otherwise PASS. `pass` covers the found parts only.
export const judged = (id, name, rule, pass, measured, unjudged = []) => {
  const missing = unjudged.filter(Boolean)
  if (!pass)
    return verdict(
      id,
      name,
      rule,
      false,
      missing.length
        ? `${measured}; not judged: ${missing.join("; ")}`
        : measured
    )
  if (missing.length)
    return stale(
      id,
      name,
      `not judged: ${missing.join("; ")}; ${measured}`,
      rule
    )
  return verdict(id, name, rule, true, measured)
}

export function summarize(results) {
  const lines = results.map(
    (r) =>
      `${r.status} ${r.id} ${r.name}: ${r.measured.slice(0, 230)} | rule: ${r.rule}`
  )
  const by = (status) => results.filter((r) => r.status === status)
  const [failed, staled] = [by("FAIL"), by("STALE")]
  const ids = [...failed, ...staled].map((r) => r.id)
  lines.push(
    `${by("PASS").length} PASS, ${failed.length} FAIL, ${staled.length} STALE${ids.length ? `: ${ids.join(" ")}` : ""}`
  )
  return { lines, exit: staled.length ? 3 : failed.length ? 1 : 0 }
}
