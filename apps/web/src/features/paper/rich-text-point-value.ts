export type PointRange = { min: number; max: number; step: number | "any" }

export function parsePointValue(text: string): number | null {
  const match = /^\s*(\d+)(?:[.,](\d+))?\s*$/.exec(text)
  if (!match) return null
  return Number(`${match[1]}.${match[2] ?? "0"}`)
}

function onStep(value: number, step: number) {
  const units = value / step
  return Math.abs(units - Math.round(units)) < 1e-9
}

export function pointValueProblem(
  text: string,
  { min, max, step }: PointRange
): string {
  const value = parsePointValue(text)
  if (value === null) return "Enter a number, such as 10.5 or 10,5."
  if (value < min || value > max) return `Enter a value from ${min} to ${max}.`
  if (step !== "any" && !onStep(value, step))
    return step === 0.5
      ? "Use whole or half points, such as 10 or 10.5."
      : `Use steps of ${step}.`
  return ""
}

export function checkPointInput(input: HTMLInputElement, range: PointRange) {
  input.setCustomValidity(pointValueProblem(input.value, range))
  return input.reportValidity()
}
