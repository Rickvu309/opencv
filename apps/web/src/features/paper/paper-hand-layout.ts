import {
  entryName,
  entrySection,
  type LibraryEntry,
  type LibraryView,
} from "./paper-library-entries.ts"

export const HAND_SPREAD = 3.6
export const HAND_NARROW_SPREAD = 2.6
export const HAND_OPACITY_REACH = 3.5
export const HAND_STEP_RATIO = 0.58
export const HAND_ROTATE_DEG = 7
export const HAND_ARC_PX = 7
export const HAND_LIFT_PX = 34
export const HAND_HOVER_SCALE = 1.04
export const HAND_HOVER_ROTATE = 0.35
export const HAND_NEIGHBOR_PX = 22
export const HAND_RUBBER = 0.25
export const HAND_WHEEL_DIVISOR = 110
export const HAND_MOMENTUM = 2.2
export const HAND_NARROW_WIDTH = 768

export function handLimit(count: number) {
  return Math.max(0, count - 1)
}

export function handClamp(pos: number, count: number) {
  if (count <= 0) return 0
  return Math.min(handLimit(count), Math.max(0, pos))
}

export function handCentre(pos: number, count: number) {
  return handClamp(Math.ceil(pos - 0.5), count)
}

export function handBand(pos: number, count: number) {
  if (count <= 0) return 0
  const hi = handLimit(count)
  if (pos < 0) return pos * HAND_RUBBER
  if (pos > hi) return hi + (pos - hi) * HAND_RUBBER
  return pos
}

export function handCardWidth(viewport: number) {
  return Math.min(220, Math.max(150, viewport * 0.22))
}

export function handStep(cardWidth: number) {
  return cardWidth * HAND_STEP_RATIO
}

export function handSpread(viewport: number) {
  return viewport < HAND_NARROW_WIDTH ? HAND_NARROW_SPREAD : HAND_SPREAD
}

export function handWheel(pos: number, delta: number, count: number) {
  return handBand(pos + delta / HAND_WHEEL_DIVISOR, count)
}

export function handDrag(
  startPos: number,
  dx: number,
  step: number,
  count: number
) {
  if (step === 0) return handBand(startPos, count)
  return handBand(startPos - dx / step, count)
}

export function handRelease(pos: number, velocity: number, count: number) {
  return handClamp(Math.round(pos - velocity * HAND_MOMENTUM), count)
}

export type HandPose = {
  x: number
  y: number
  rotate: number
  scale: number
  opacity: number
  hidden: boolean
  z: number
}

export function handPose({
  index,
  pos,
  step,
  spread,
  hovered,
  shift,
  reduced,
}: {
  index: number
  pos: number
  step: number
  spread: number
  hovered: number
  shift: boolean
  reduced: boolean
}): HandPose {
  const raw = index - pos
  const hidden = Math.abs(raw) > spread
  let d = Math.max(-spread, Math.min(spread, raw))
  if (shift) d = Math.max(-spread, Math.min(spread, d + 1))
  let rotate = d * HAND_ROTATE_DEG
  let x = d * step
  let y = d * d * HAND_ARC_PX
  let scale = 1
  const lifted = !reduced && !shift && !hidden && hovered === index
  if (lifted) {
    rotate *= HAND_HOVER_ROTATE
    y -= HAND_LIFT_PX
    scale = HAND_HOVER_SCALE
  } else if (!reduced && !shift && hovered >= 0 && hovered !== index) {
    x += (index < hovered ? -1 : 1) * HAND_NEIGHBOR_PX
  }
  const opacity = hidden
    ? 0
    : Math.max(0, Math.min(1, HAND_OPACITY_REACH - Math.abs(raw)))
  const z =
    hovered === index
      ? 100
      : 50 - Math.round(Math.abs(raw) * 2) * 2 - (raw > 0 ? 1 : 0)
  return { x, y, rotate, scale, opacity, hidden, z }
}

export function handTransform(pose: HandPose, entering: boolean) {
  if (entering) return "translate(0px, 40px) scale(0.96)"
  return `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scale})`
}

function entryTime(entry: LibraryEntry) {
  const iso =
    entry.type === "paper"
      ? entry.doc.updatedAt
      : entry.type === "file"
        ? entry.file.createdAt
        : ""
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

export function handFold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
}

export function handNear(index: number, pos: number) {
  return Math.abs(index - pos) <= HAND_SPREAD + 2
}

export function handCards(list: readonly LibraryEntry[], pos: number) {
  return list.flatMap((entry, index) =>
    handNear(index, pos) ? [{ entry, index }] : []
  )
}

export function handPreviewIds(cards: ReturnType<typeof handCards>) {
  return cards.flatMap(({ entry }) =>
    entry.type === "paper" && entry.doc.engine === 2 ? [entry.doc.id] : []
  )
}

export function handList(
  entries: readonly LibraryEntry[],
  view: LibraryView,
  query: string
) {
  if (view === "proofs") return []
  const needle = handFold(query.trim())
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (view !== "all" && entrySection(entry) !== view) return false
      return needle === "" || handFold(entryName(entry)).includes(needle)
    })
    .sort(
      (a, b) => entryTime(b.entry) - entryTime(a.entry) || a.index - b.index
    )
    .map(({ entry }) => entry)
}

export function handCounts(entries: readonly LibraryEntry[]) {
  const counts: Partial<Record<LibraryView, number>> = {}
  for (const view of ["all", "cv", "letter", "files"] as const)
    counts[view] = handList(entries, view, "").length
  return counts
}
