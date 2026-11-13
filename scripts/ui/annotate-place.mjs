export const PREFERRED = Object.freeze([
  ["up-left", -135],
  ["up-right", -45],
  ["left", 180],
  ["right", 0],
  ["down-left", 135],
  ["down-right", 45],
  ["up", -90],
  ["down", 90],
  ["up-left-steep", -112.5],
  ["up-right-steep", -67.5],
  ["left-up", -157.5],
  ["right-up", -22.5],
  ["left-down", 157.5],
  ["right-down", 22.5],
  ["down-left-steep", 112.5],
  ["down-right-steep", 67.5],
])
export const PLACEMENT_ORDER = PREFERRED.slice(0, 8).map(([name]) => name)
export const RINGS = Object.freeze([1, 0.6, 1.5, 2.1, 2.9, 4, 5.5])
const OPTIONS = RINGS.flatMap((stretch, ring) =>
  PREFERRED.map(([name, degrees], order) => ({
    name,
    ux: Math.cos((degrees * Math.PI) / 180),
    uy: Math.sin((degrees * Math.PI) / 180),
    stretch,
    ring,
    order,
  }))
)
export const PENALTY = Object.freeze({
  outside: 1e6,
  badge: 1e5,
  covered: 1e4,
  crossing: 1e3,
  through: 1e3,
  overTarget: 20,
  ring: 2,
  order: 0.1,
})
const CLEAR_BELOW = PENALTY.crossing
const UNCROSS_ROUNDS = 60

const roundPoint = (point) => ({
  x: Math.round(point.x * 1000) / 1000,
  y: Math.round(point.y * 1000) / 1000,
})

export const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height

export const contains = (outer, inner) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

export function circleHitsBox(center, radius, box) {
  const nearX = Math.min(Math.max(center.x, box.x), box.x + box.width)
  const nearY = Math.min(Math.max(center.y, box.y), box.y + box.height)
  return Math.hypot(center.x - nearX, center.y - nearY) < radius
}

export function boundaryPoint(box, ux, uy) {
  const half = { x: box.width / 2, y: box.height / 2 }
  const center = { x: box.x + half.x, y: box.y + half.y }
  const reach = Math.min(
    Math.abs(ux) > 1e-9 ? half.x / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-9 ? half.y / Math.abs(uy) : Infinity
  )
  const along = Number.isFinite(reach) ? reach : 0
  return { x: center.x + ux * along, y: center.y + uy * along }
}

export function distanceToBoxEdge(point, box) {
  const inside =
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  if (inside)
    return Math.min(
      point.x - box.x,
      box.x + box.width - point.x,
      point.y - box.y,
      box.y + box.height - point.y
    )
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width))
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height))
  return Math.hypot(dx, dy)
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

export function segmentsCross(a, b) {
  const d1 = cross(b.from, b.to, a.from)
  const d2 = cross(b.from, b.to, a.to)
  const d3 = cross(a.from, a.to, b.from)
  const d4 = cross(a.from, a.to, b.to)
  return d1 * d2 < 0 && d3 * d4 < 0
}

export function segmentHitsCircle(segment, center, radius) {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  const length = dx * dx + dy * dy || 1
  const t = Math.min(
    1,
    Math.max(
      0,
      ((center.x - segment.from.x) * dx + (center.y - segment.from.y) * dy) /
        length
    )
  )
  return (
    Math.hypot(
      segment.from.x + dx * t - center.x,
      segment.from.y + dy * t - center.y
    ) < radius
  )
}

export function segmentHitsBox(segment, box) {
  const steps = 24
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps
    const x = segment.from.x + (segment.to.x - segment.from.x) * t
    const y = segment.from.y + (segment.to.y - segment.from.y) * t
    if (
      x > box.x &&
      x < box.x + box.width &&
      y > box.y &&
      y < box.y + box.height
    )
      return true
  }
  return false
}

export function arrowBetween(center, box, sizes) {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const away = Math.hypot(center.x - cx, center.y - cy) || 1
  const anchor = boundaryPoint(
    box,
    (center.x - cx) / away,
    (center.y - cy) / away
  )
  const length = Math.hypot(anchor.x - center.x, anchor.y - center.y) || 1
  const ux = (anchor.x - center.x) / length
  const uy = (anchor.y - center.y) / length
  return {
    from: roundPoint({
      x: center.x + ux * sizes.radius,
      y: center.y + uy * sizes.radius,
    }),
    to: roundPoint(anchor),
    length,
  }
}

function candidate(box, option, sizes) {
  const anchor = boundaryPoint(box, option.ux, option.uy)
  const reach = sizes.reach * option.stretch
  const center = roundPoint({
    x: anchor.x + option.ux * reach,
    y: anchor.y + option.uy * reach,
  })
  return { direction: option.name, center, ...arrowBetween(center, box, sizes) }
}

export function badgeInside(center, bounds, sizes) {
  const edge = sizes.radius + sizes.ring
  return (
    center.x - edge >= 0 &&
    center.y - edge >= 0 &&
    center.x + edge <= bounds.width &&
    center.y + edge <= bounds.height
  )
}

function obstaclesFor(mark, marks) {
  return marks
    .filter((other) => other === mark || !contains(other.box, mark.box))
    .map((other) => other.box)
}

export const passBy = (sizes) => sizes.radius + sizes.ring

function score(option, mark, side, placed, sizes, rank) {
  const reach = sizes.radius + sizes.clearance
  const outside = badgeInside(option.center, side.bounds, sizes) ? 0 : 1
  const covered = obstaclesFor(mark, side.marks).filter((box) =>
    circleHitsBox(option.center, reach, box)
  ).length
  const badges = placed.filter(
    (done) =>
      Math.hypot(
        option.center.x - done.center.x,
        option.center.y - done.center.y
      ) <
      sizes.radius * 2 + sizes.clearance
  ).length
  const crossings = placed.filter((done) => segmentsCross(option, done)).length
  const through =
    placed.filter((done) =>
      segmentHitsCircle(option, done.center, passBy(sizes))
    ).length +
    placed.filter((done) =>
      segmentHitsCircle(done, option.center, passBy(sizes))
    ).length
  const overTargets = side.marks.filter(
    (other) =>
      other !== mark &&
      !contains(other.box, mark.box) &&
      segmentHitsBox(option, other.box)
  ).length
  const blocked =
    outside * PENALTY.outside +
    badges * PENALTY.badge +
    covered * PENALTY.covered
  const tangled = crossings * PENALTY.crossing + through * PENALTY.through
  return {
    blocked,
    penalty:
      blocked +
      tangled +
      overTargets * PENALTY.overTarget +
      rank.ring * PENALTY.ring +
      rank.order * PENALTY.order,
  }
}

function conflicts(marks, sizes) {
  let count = 0
  const reach = passBy(sizes)
  marks.forEach((a, at) => {
    marks.forEach((b, other) => {
      if (at === other) return
      if (other > at && segmentsCross(a, b)) count += 1
      if (segmentHitsCircle(a, b.center, reach)) count += 1
    })
  })
  return count
}

function badgeAllowed(center, mark, side, sizes) {
  const reach = sizes.radius + sizes.clearance
  return (
    badgeInside(center, side.bounds, sizes) &&
    obstaclesFor(mark, side.marks).every(
      (box) => !circleHitsBox(center, reach, box)
    )
  )
}

export function uncross(marks, side, sizes) {
  const byN = new Map(side.marks.map((mark) => [mark.n, mark]))
  let current = marks
  for (let round = 0; round < UNCROSS_ROUNDS; round += 1) {
    const before = conflicts(current, sizes)
    if (before === 0) break
    let improved = false
    for (let i = 0; i < current.length && !improved; i += 1)
      for (let j = i + 1; j < current.length && !improved; j += 1) {
        const a = current[i]
        const b = current[j]
        if (
          !segmentsCross(a, b) &&
          !segmentHitsCircle(a, b.center, sizes.radius) &&
          !segmentHitsCircle(b, a.center, sizes.radius)
        )
          continue
        const aMark = byN.get(a.n)
        const bMark = byN.get(b.n)
        if (
          !badgeAllowed(b.center, aMark, side, sizes) ||
          !badgeAllowed(a.center, bMark, side, sizes)
        )
          continue
        const swappedA = {
          ...a,
          center: b.center,
          ...arrowBetween(b.center, aMark.box, sizes),
        }
        const swappedB = {
          ...b,
          center: a.center,
          ...arrowBetween(a.center, bMark.box, sizes),
        }
        const shortest = sizes.radius + sizes.head
        if (swappedA.length < shortest || swappedB.length < shortest) continue
        const next = current.map((mark) =>
          mark === a ? swappedA : mark === b ? swappedB : mark
        )
        const after = conflicts(next, sizes)
        const shorter =
          swappedA.length + swappedB.length <
          (a.length ?? Infinity) + (b.length ?? Infinity)
        if (after < before || (after === before && shorter)) {
          current = next
          improved = true
        }
      }
    if (!improved) {
      const moved = relocate(current, side, sizes, byN)
      if (!moved || conflicts(moved, sizes) >= before) break
      current = moved
    }
  }
  return current
}

const PAIR_TRIES = 24
const PREFERENCES = Object.freeze([null, "down", "up", "left", "right"])
const NEIGHBOURS = 6

function nearest(mark, current) {
  const far = (other) =>
    Math.hypot(other.to.x - mark.to.x, other.to.y - mark.to.y)
  return current
    .filter((other) => other !== mark)
    .sort((a, b) => far(a) - far(b))
    .slice(0, NEIGHBOURS)
}

function freeSpots(mark, side, others, sizes) {
  return OPTIONS.map((option) => {
    const shape = candidate(mark.box, option, sizes)
    return { shape, ...score(shape, mark, side, others, sizes, option) }
  })
    .filter((option) => option.penalty < PENALTY.crossing)
    .sort((a, b) => a.penalty - b.penalty)
}

const moveTo = (mark, { direction, center, from, to, length }) => ({
  ...mark,
  direction,
  center,
  from,
  to,
  length,
})

function relocate(current, side, sizes, byN) {
  const tangled = current.filter((mark) =>
    current.some(
      (other) =>
        other !== mark &&
        (segmentsCross(mark, other) ||
          segmentHitsCircle(mark, other.center, passBy(sizes)))
    )
  )
  for (const mark of tangled) {
    const others = current.filter((other) => other !== mark)
    const [spot] = freeSpots(byN.get(mark.n), side, others, sizes)
    if (spot)
      return current.map((item) =>
        item === mark ? moveTo(item, spot.shape) : item
      )
  }
  for (const a of tangled)
    for (const b of nearest(a, current)) {
      const others = current.filter((other) => other !== a && other !== b)
      let best = null
      for (const spotA of freeSpots(byN.get(a.n), side, others, sizes).slice(
        0,
        PAIR_TRIES
      )) {
        const movedA = moveTo(a, spotA.shape)
        const [spotB] = freeSpots(
          byN.get(b.n),
          side,
          [...others, movedA],
          sizes
        )
        if (!spotB) continue
        const total = spotA.penalty + spotB.penalty
        if (!best || total < best.total)
          best = { total, movedA, movedB: moveTo(b, spotB.shape) }
      }
      if (best)
        return current.map((item) =>
          item === a ? best.movedA : item === b ? best.movedB : item
        )
    }
  return null
}

const rankFor = (option, prefer) =>
  !prefer || option.name === prefer
    ? option
    : { ring: option.ring, order: option.order + PREFERRED.length }

function placeInOrder(sides, sizes, numbers, prefer) {
  const placed = sides.map(() => [])
  for (const n of numbers) {
    const scored = sides.map((side, at) => {
      const mark = side.marks.find((item) => item.n === n)
      if (!mark) return null
      return {
        mark,
        options: OPTIONS.map((option) => {
          const shape = candidate(mark.box, option, sizes)
          return {
            ...shape,
            ...score(
              shape,
              mark,
              side,
              placed[at],
              sizes,
              rankFor(option, prefer)
            ),
          }
        }),
      }
    })
    const totals = OPTIONS.map((_, index) =>
      scored.reduce(
        (sum, side) => sum + (side ? side.options[index].penalty : 0),
        0
      )
    )
    const best = totals.indexOf(Math.min(...totals))
    scored.forEach((side, at) => {
      if (!side) return
      const { blocked, penalty: _penalty, ...shape } = side.options[best]
      placed[at].push({
        n,
        ghost: side.mark.ghost === true,
        ...shape,
        clear: blocked < CLEAR_BELOW,
      })
    })
  }
  return placed.map((marks, at) => uncross(marks, sides[at], sizes))
}

function centerOf(sides, n) {
  const box = sides
    .map((side) => side.marks.find((mark) => mark.n === n)?.box)
    .find(Boolean)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function orders(sides, numbers) {
  const at = new Map(numbers.map((n) => [n, centerOf(sides, n)]))
  const by = (key, sign = 1) =>
    [...numbers].sort(
      (a, b) => sign * (at.get(a)[key] - at.get(b)[key]) || a - b
    )
  return [numbers, by("x"), by("x", -1), by("y"), by("y", -1)]
}

function cost(placed, sizes) {
  return placed.reduce(
    (sum, marks) =>
      sum +
      marks.filter((mark) => !mark.clear).length * PENALTY.badge +
      crossingPairs(marks).length * PENALTY.crossing +
      conflicts(marks, sizes),
    0
  )
}

export function placeCallouts(sides, sizes) {
  const numbers = [
    ...new Set(sides.flatMap((side) => side.marks.map((mark) => mark.n))),
  ]
  let best = null
  for (const prefer of PREFERENCES)
    for (const order of orders(sides, numbers)) {
      if (best?.total === 0) break
      const placed = placeInOrder(sides, sizes, order, prefer)
      const total = cost(placed, sizes)
      if (!best || total < best.total) best = { placed, total }
    }
  return best.placed.map((marks) =>
    marks.sort((a, b) => a.n - b.n).map(({ length: _length, ...mark }) => mark)
  )
}

export function crossingPairs(marks) {
  const pairs = []
  marks.forEach((a, at) =>
    marks.slice(at + 1).forEach((b) => {
      if (segmentsCross(a, b)) pairs.push([a.n, b.n])
    })
  )
  return pairs
}
