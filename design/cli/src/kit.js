import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { slug } from "./build.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let cached

export function loadKit(
  path = process.env.OPENCV_KIT || join(root, "data", "kit.json")
) {
  if (!cached || cached.path !== path)
    cached = { path, kit: JSON.parse(readFileSync(path, "utf8")) }
  return cached.kit
}

export function loadRules() {
  return JSON.parse(readFileSync(join(root, "data", "rules.json"), "utf8"))
}

export function allVariants(kit) {
  return kit.components.flatMap((c) =>
    c.variants.map((v) => ({ ...v, component: c.key, kind: c.kind }))
  )
}

export function findComponent(kit, query) {
  const q = slug(query)
  const exact =
    kit.components.find((c) => c.key === q) ||
    kit.components.find((c) => c.aliases.includes(q))
  if (exact) return exact
  const loose = kit.components.filter(
    (c) =>
      c.key.includes(q) ||
      slug(c.name).includes(q) ||
      c.aliases.some((a) => a.includes(q))
  )
  return loose.length === 1 ? loose[0] : null
}

export function searchComponents(kit, query) {
  const q = slug(query || "")
  if (!q) return kit.components
  return kit.components.filter(
    (c) =>
      c.key.includes(q) ||
      c.aliases.some((a) => a.includes(q)) ||
      slug(c.desc).includes(q) ||
      c.variants.some((v) => slug(v.name).includes(q) || v.id === query)
  )
}

const DEFAULTS = ["default", "md"]

// Picks one master from free-form terms: "button primary lg hover", "checkbox on", or an id.
export function resolveVariant(kit, terms) {
  const list = allVariants(kit)
  if (terms.length === 1) {
    const byId = list.find((v) => v.id === terms[0])
    if (byId) return { variant: byId, candidates: [byId] }
  }
  const words = terms
    .flatMap((t) => String(t).split(/[\s/]+/))
    .map(slug)
    .filter(Boolean)
  if (!words.length) return { variant: null, candidates: [] }

  const scored = []
  for (const v of list) {
    const parts = v.parts.map(slug)
    const joined = slug(v.name)
    let score = 0
    let ok = true
    for (const w of words) {
      if (parts.includes(w)) score += 10
      else if (parts.some((p) => p.startsWith(w)) || joined.includes(w))
        score += 4
      else if (v.component === w || slug(v.component).startsWith(w)) score += 3
      else {
        ok = false
        break
      }
    }
    if (!ok) continue
    if (parts[0] === words[0] || slug(v.component) === words[0]) score += 6
    for (const d of DEFAULTS)
      if (parts.includes(d) && !words.includes(d)) score += 1
    if (/deprecated/i.test(v.name)) score -= 50
    score -= parts.length * 0.1
    scored.push({ v, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return {
    variant: scored[0]?.v || null,
    candidates: scored.slice(0, 8).map((s) => s.v),
  }
}

export function tokenHexMap(kit) {
  const map = new Map()
  for (const [name, t] of Object.entries(kit.tokens)) {
    if (t.type === "color" && typeof t.value === "string") {
      const hex = t.value.toUpperCase()
      if (!map.has(hex)) map.set(hex, [])
      map.get(hex).push(name)
    }
  }
  return map
}
