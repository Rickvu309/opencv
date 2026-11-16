import type { Point } from "./measure.ts"
import { warn } from "./util.ts"

export function checkSeam(
  end: object,
  initial: object,
  at: Point,
  rest: Point | null
) {
  const changed = Object.keys(initial).filter(
    (k) =>
      JSON.stringify((end as Record<string, unknown>)[k]) !==
      JSON.stringify((initial as Record<string, unknown>)[k])
  )
  if (changed.length)
    warn(
      `loop seam: state still differs from initial at the end of the script (${changed.join(", ")})`
    )
  if (rest && Math.hypot(at.x - rest.x, at.y - rest.y) > 1)
    warn("loop seam: cursor does not end where it starts")
}
