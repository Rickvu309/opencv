// The result shape shared by the landing checks. STALE means the check's own precondition did not hold
// (its locator matched nothing), so it says nothing about the page.
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
