import { staleOutputs } from "./catalog-freshness.mjs"

export const staleFiles = (expected, current) =>
  staleOutputs(expected, current).map((error) => error.file)

export function detect(text) {
  const { expected, current } = JSON.parse(text)
  return staleFiles(expected, current)
}
