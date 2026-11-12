const NO_KEPT_OUTCOME_FRAME =
  "the pen file has no frame for the approval card's kept outcome after a reload"

export const SHOT_ONLY = {
  "coach-denied-reloaded": NO_KEPT_OUTCOME_FRAME,
  "coach-receipt-reloaded": NO_KEPT_OUTCOME_FRAME,
  "coach-undone-reloaded": NO_KEPT_OUTCOME_FRAME,
  "coach-stopped-reloaded": NO_KEPT_OUTCOME_FRAME,
  "coach-expired-reloaded": NO_KEPT_OUTCOME_FRAME,
}

export function unmappedMessage(ids, shotOnly = SHOT_ONLY) {
  const framed = ids.filter((id) => !(id in shotOnly))
  return [
    ...ids
      .filter((id) => id in shotOnly)
      .map(
        (id) =>
          `${id}: no design frame for this screen (${shotOnly[id]}); it is shot-only, use node scripts/ui.mjs shot ${id}`
      ),
    ...(framed.length
      ? [
          `no design rows for ${framed.join(", ")}; add rows to scripts/ui/design-map.mjs`,
        ]
      : []),
  ].join("\n")
}

export function shotOnlyProblems(shotOnly, screens, map) {
  const known = new Set(screens.map((screen) => screen.id))
  const mapped = new Set(map.map((row) => row.screen))
  return Object.keys(shotOnly).flatMap((id) => [
    ...(known.has(id) ? [] : [`${id}: shot-only but not a screen`]),
    ...(mapped.has(id)
      ? [`${id}: shot-only but has design rows; drop it from SHOT_ONLY`]
      : []),
  ])
}
