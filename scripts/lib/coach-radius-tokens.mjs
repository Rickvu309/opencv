const RADIUS_LITERAL = /(?<![\w-])rounded(?:-[a-z]{1,2})?-\[[\d.]+px\]/g

export const COACH_RADIUS_HINT =
  "Coach corners use the radius tokens (rounded-sm, rounded-md, rounded-lg) or the kit ActionCard, never a pixel literal"

export function isCoachSource(file) {
  return (
    file.startsWith("apps/web/src/features/coach/") &&
    /\.[jt]sx?$/.test(file) &&
    !/\.test\.[jt]sx?$/.test(file)
  )
}

export function coachRadiusLiterals(source, fileName = "coach.tsx") {
  return [...source.matchAll(RADIUS_LITERAL)].map(
    (match) =>
      `${fileName}:${source.slice(0, match.index).split("\n").length}: ${match[0]}; ${COACH_RADIUS_HINT}`
  )
}
