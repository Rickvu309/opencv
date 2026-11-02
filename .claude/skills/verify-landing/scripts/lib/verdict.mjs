import {
  checkLine,
  summaryLine,
} from "../../../verify-app-ui/scripts/lib/tier.mjs"

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
export const staleIf = (why, v) => (why ? stale(v.id, v.name, why, v.rule) : v)

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

export function summarize(results, tier) {
  const lines = results.map(checkLine)
  lines.push(summaryLine(results, tier))
  const by = (status) => results.some((r) => r.status === status)
  return { lines, exit: by("STALE") ? 3 : by("FAIL") ? 1 : 0 }
}
