// Shared by both checkers. Each check has one kind: "invariant" holds for any good design, "design" holds only for
// the current one. A tier picks which kinds run; the kinds a tier leaves out are not computed.
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

// want("27") is false for a design check in the invariant tier, so its code does not run. The design tier runs the
// whole checker and keeps only the design results, so a design check never depends on what an invariant check set up.
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
