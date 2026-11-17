import {
  computeFriction,
  frictionWindow,
  renderFriction,
} from "../friction.mjs"
import { fetchFriction } from "../ports/friction.mjs"
import { needsValue, unknownOption } from "../input.mjs"

export function friction(ctx, { flags, pos }) {
  for (const flag of Object.keys(flags)) {
    if (!["--since", "--until", "--json"].includes(flag)) unknownOption(flag)
    if (
      flag !== "--json" &&
      (typeof flags[flag] !== "string" || flags[flag].startsWith("--"))
    )
      needsValue(flag)
  }
  if (pos.length)
    throw new Error(
      "usage: ocv-tools friction --since <iso> [--until <iso>] [--json]"
    )
  if (!flags["--since"]) needsValue("--since")
  const window = frictionWindow(
    flags["--since"],
    flags["--until"] ?? new Date(ctx.now()).toISOString()
  )
  const report = computeFriction(fetchFriction(ctx, window))
  return {
    lines: [
      flags["--json"]
        ? JSON.stringify(report, null, 2)
        : renderFriction(report),
    ],
  }
}
