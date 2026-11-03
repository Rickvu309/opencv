export const TIERS = ["invariant", "design", "all"]

export function tierFromEnv(env = process.env) {
  const tier = env.VERIFY_TIER ?? "all"
  if (!TIERS.includes(tier))
    throw new Error(`VERIFY_TIER must be ${TIERS.join(", ")}; got "${tier}"`)
  return tier
}

const kindOf = (kinds, id) => {
  if (!(id in kinds))
    throw new Error(`check ${id} has no kind; add it to scripts/lib/kinds.mjs`)
  return kinds[id]
}

export const gate = (kinds, tier) => (id) =>
  tier !== "invariant" || kindOf(kinds, id) === "invariant"

export const selectTier = (kinds, tier, results) =>
  results
    .map((r) => ({ ...r, kind: kindOf(kinds, r.id) }))
    .filter((r) => tier !== "design" || r.kind === "design")

export const checkLine = (r) =>
  `${r.status} ${r.id}${r.kind ? ` [${r.kind}]` : ""} ${r.name}: ${r.measured.slice(0, 230)} | rule: ${r.rule}`

export function summaryLine(results, tier) {
  const by = (status) => results.filter((r) => r.status === status)
  const ids = [...by("FAIL"), ...by("STALE")].map((r) => r.id)
  return `${by("PASS").length} PASS, ${by("FAIL").length} FAIL, ${by("STALE").length} STALE${ids.length ? `: ${ids.join(" ")}` : ""}${tier ? ` [tier ${tier}]` : ""}`
}
