const A4_HEIGHT_FALLBACK_PX = 1123
const A4_WIDTH_FALLBACK_PX = 794

export const A4_HEIGHT_PX = A4_HEIGHT_FALLBACK_PX
export const A4_WIDTH_PX = A4_WIDTH_FALLBACK_PX

export function readA4FitWidth(availablePx: number, naturalPx: number): number {
  if (!(naturalPx > 0)) return availablePx > 0 ? availablePx : 0
  if (!(availablePx > 0)) return naturalPx
  return Math.min(availablePx, naturalPx)
}

export function readA4FitScale(availablePx: number, naturalPx: number): number {
  const fit = readA4FitWidth(availablePx, naturalPx)
  if (!(naturalPx > 0) || !(fit > 0)) return 1
  return Math.min(1, fit / naturalPx)
}

export function readA4HeightPx(target?: Element | null): number {
  const node =
    target ??
    (typeof document === "undefined" ? null : document.documentElement)
  if (!node) return A4_HEIGHT_FALLBACK_PX
  const raw = getComputedStyle(node).getPropertyValue("--cv-page-height")
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : A4_HEIGHT_FALLBACK_PX
}
