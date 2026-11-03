import { decide, refusalError } from "./rules/index.mjs"

const FINE = {
  flags: {},
  command: { known: true },
  flag: { known: true },
  args: { ok: true },
  token: { ok: true },
}

export function badInput(found) {
  const verdict = decide("cli", { ...FINE, ...found })
  if (verdict.ok) throw new Error("input expected a refusal")
  throw refusalError(verdict.refusals[0])
}

export const unknownOption = (name, hint) =>
  badInput({ flag: { known: false, name, hint } })
export const needsValue = (flag) => badInput({ missingValue: flag })
