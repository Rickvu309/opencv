import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

function resolveKitPath() {
  const configured = process.env.ANATOMY_KIT_PATH
  if (typeof configured === "string" && configured.trim())
    return configured.trim()
  return join(homedir(), ".agents", "skills", "anatomy", "kit", "iso-kit.mjs")
}

const kitPath = resolveKitPath()
if (!existsSync(kitPath)) {
  throw new Error(
    `Anatomy iso-kit not found at ${kitPath}. Set ANATOMY_KIT_PATH to iso-kit.mjs. The toolkit is generation-only and is not vendored in this repo.`
  )
}

const k = await import(pathToFileURL(kitPath).href)
if (typeof k.iso !== "function") {
  throw new Error(
    `Anatomy iso-kit at ${kitPath} did not export iso. Set ANATOMY_KIT_PATH to iso-kit.mjs.`
  )
}

export const VIEW = { width: 405, height: 388 }
export const MOTION = {
  platenDrop: 24,
  pinDrop: 6.5,
  plotterStops: [
    { x: -42, y: 4 },
    { x: -18, y: 11 },
    { x: 32, y: 6 },
  ],
  plotterLift: 7,
  dispatchBays: [-46, -23, 0, 23, 46],
}

const AZIMUTH = 45
const ELEVATION = 30
const corners = []
for (const x of [-78, 78]) {
  for (const y of [-50, 50]) {
    for (const z of [-14, 76]) corners.push([x, y, z])
  }
}
const unit = {
  origin: [0, 0],
  scale: 1,
  azimuth: AZIMUTH,
  elevation: ELEVATION,
}
const flat = corners.map((point) => k.iso(point, unit))
const xs = flat.map((point) => point[0])
const ys = flat.map((point) => point[1])
const minX = Math.min(...xs)
const maxX = Math.max(...xs)
const minY = Math.min(...ys)
const maxY = Math.max(...ys)
const scale = Math.min(
  (VIEW.width * 0.62) / (maxX - minX),
  (VIEW.height * 0.62) / (maxY - minY)
)
export const P = {
  origin: [
    VIEW.width / 2 - ((minX + maxX) / 2) * scale,
    VIEW.height / 2 - ((minY + maxY) / 2) * scale,
  ],
  scale,
  azimuth: AZIMUTH,
  elevation: ELEVATION,
}

const SOLE = { x: -72, y: -44, w: 144, d: 88, r: 4 }

export const S = (paths, tone, extra = {}) =>
  k.solidSvg(paths, { tone, ...extra })
export const L = (d, tone = "lo", extra = {}) =>
  k.lineSvg(d, { tone, ...extra })
export const D = (points, size = 0.45) =>
  k.dotsSvg(points, { size, tone: "mid" })

export function screw(x, y, z) {
  return L(k.ring(x, y, 1.35, z, P, 10), "lo") + D([k.iso([x, y, z], P)])
}

export function coilZ(cx, cy, z0, z1, radius, turns) {
  const count = Math.max(8, Math.round(turns * 10))
  const back = []
  const front = []
  let run = []
  let near = null
  for (let index = 0; index <= count; index += 1) {
    const share = index / count
    const angle = share * turns * Math.PI * 2
    const point = [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
      z0 + (z1 - z0) * share,
    ]
    const facing = k.depthOf([Math.cos(angle), Math.sin(angle), 0], P) > 0
    const projected = k.iso(point, P)
    if (near === null) near = facing
    if (facing !== near) {
      run.push(projected)
      ;(near ? front : back).push(k.pathOf(run))
      run = [projected]
      near = facing
      continue
    }
    run.push(projected)
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run))
  return { back: back.join(""), front: front.join("") }
}

export function createScene() {
  const names = new Set()
  const layers = { back: [], cover: [], near: [] }
  const moves = {}
  const claim = (name) => {
    if (names.has(name)) throw new Error(`duplicate ${name}`)
    names.add(name)
  }
  const group = (name, svg, extra = "") => {
    if (!svg) throw new Error(`empty ${name}`)
    return `<g data-part="${name}"${extra}>${svg}</g>`
  }
  return {
    names,
    layers,
    moves,
    back(name, svg, extra) {
      claim(name)
      layers.back.push(group(name, svg, extra))
    },
    cover(name, svg, extra) {
      claim(name)
      layers.cover.push(group(name, svg, extra))
    },
    near(name, svg, extra) {
      claim(name)
      layers.near.push(group(name, svg, extra))
    },
    move(name, svg, extra) {
      claim(name)
      moves[name] = group(name, svg, extra)
    },
  }
}

export function foundation(scene, word, id) {
  scene.back(
    "halo",
    `<path class="iso-halo" d="${k.haloOf(SOLE, -13, 8, P)}"/>`
  )
  const feet = [...k.corners(SOLE, 14)].sort(
    (a, b) => k.depthOf([a[0], a[1], -8], P) - k.depthOf([b[0], b[1], -8], P)
  )
  feet.forEach(([x, y], index) => {
    scene.back(
      `foot-${index}`,
      S(k.cylinder(x, y, 5.2, -12, 1.5, P, 12), "lo") +
        S(k.cylinder(x, y, 3.9, -10.5, 3.5, P, 12), "mid")
    )
    scene.back(`foot-screw-${index}`, screw(x, y, 0.25))
  })
  scene.back("sole", S(k.slabOf(SOLE, -7, 7, P, 4, 1), "mid"))
  scene.back(
    "groove",
    L(k.planOutline(k.insetPlan(SOLE, 4.5), 0.2, P, 4), "faint")
  )
  const plan = { x: -54, y: 33, w: 30, d: 8, r: 1 }
  const z = 0.75
  const clip = k.planOutline(k.insetPlan(plan, 1.3), z, P, 3)
  const text = k.faceTextSvg(
    k.topMatrix([plan.x + plan.w / 2, plan.y + plan.d / 2], z + 0.05, P, "x"),
    word,
    { size: 2.4, tone: "mid", anchor: "middle" }
  )
  scene.back(
    "label",
    S(k.slabOf(plan, 0, z, P, 3, 0.3), "lo", { crease: "none" }) +
      L(k.planOutline(k.insetPlan(plan, 1.1), z, P, 3), "faint") +
      `<defs><clipPath id="lf-${id}-label"><path d="${clip}"/></clipPath></defs><g clip-path="url(#lf-${id}-label)">${text}</g>`
  )
  scene.back("label-screw-0", screw(plan.x + 2.4, plan.y + 4, z + 0.05))
  scene.back(
    "label-screw-1",
    screw(plan.x + plan.w - 2.4, plan.y + 4, z + 0.05)
  )
}

export function translateWorld(dx, dy, dz) {
  const radians = Math.PI / 180
  const pitch = P.scale * Math.sqrt(1.6)
  const sinA = Math.sin(P.azimuth * radians)
  const cosA = Math.cos(P.azimuth * radians)
  const sinE = Math.sin(P.elevation * radians)
  const cosE = Math.cos(P.elevation * radians)
  const x = (dx * sinA - dy * cosA) * pitch
  const y = ((dx * cosA + dy * sinA) * sinE - dz * cosE) * pitch
  const fine = (value) => Math.round(value * 100) / 100
  return `translate(${fine(x)} ${fine(y)})`
}

export function envelopeFill() {
  const projected = corners.map((point) => k.iso(point, P))
  const left = Math.min(...projected.map((point) => point[0]))
  const right = Math.max(...projected.map((point) => point[0]))
  const top = Math.min(...projected.map((point) => point[1]))
  const bottom = Math.max(...projected.map((point) => point[1]))
  return {
    width: (right - left) / VIEW.width,
    height: (bottom - top) / VIEW.height,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
  }
}

export { k }
