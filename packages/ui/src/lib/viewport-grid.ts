import type { Viewport } from "./dialog-fit"

export const GRID: readonly Viewport[] = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 390, height: 560 },
  { width: 600, height: 480 },
  { width: 820, height: 512 },
  { width: 1024, height: 700 },
  { width: 1280, height: 400 },
  { width: 1280, height: 117 },
  { width: 1366, height: 657 },
  { width: 1440, height: 900 },
]

export const sizeLabel = ({ width, height }: Viewport) => `${width}x${height}`

export function parseSize(text: string): Viewport {
  const found = /^(\d+)x(\d+)$/.exec(text.trim())
  if (!found)
    throw new Error(`a size is WIDTHxHEIGHT, like 390x844, got ${text}`)
  return { width: Number(found[1]), height: Number(found[2]) }
}
