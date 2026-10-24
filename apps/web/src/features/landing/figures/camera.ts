import { PROJECTION } from "./layout.ts"

const RADIANS = Math.PI / 180
const UNIT = Math.sqrt(1.6)

export function translateWorld(dx: number, dy: number, dz: number): string {
  const pitch = PROJECTION.scale * UNIT
  const sinA = Math.sin(PROJECTION.azimuth * RADIANS)
  const cosA = Math.cos(PROJECTION.azimuth * RADIANS)
  const sinE = Math.sin(PROJECTION.elevation * RADIANS)
  const cosE = Math.cos(PROJECTION.elevation * RADIANS)
  const x = (dx * sinA - dy * cosA) * pitch
  const y = ((dx * cosA + dy * sinA) * sinE - dz * cosE) * pitch
  const fine = (value: number) => Math.round(value * 100) / 100
  return `translate(${fine(x)} ${fine(y)})`
}
