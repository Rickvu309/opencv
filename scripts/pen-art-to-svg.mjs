// Turns one pen.dev art frame into a React SVG component.
// Usage: node scripts/pen-art-to-svg.mjs <pen file> <node id> <ComponentName>
import fs from "node:fs"

// Stock CSS variables, by colour family. An unknown colour throws.
// #272f41 and #e0e4ec are in the coach art and sit in the darkest and light-grey families.
// The blog cover adds a second set of the same families (ink, grey stroke, paper).
const COLOUR = {
  "#1d2434": "var(--foreground)",
  "#1d2633": "var(--foreground)",
  "#1f212b": "var(--foreground)",
  "#182230": "var(--foreground)",
  "#212b3c": "var(--foreground)",
  "#222a34": "var(--foreground)",
  "#232a39": "var(--foreground)",
  "#232d3d": "var(--foreground)",
  "#242e3b": "var(--foreground)",
  "#272f41": "var(--foreground)",
  "#2d3644": "var(--foreground)",
  "#535c69": "var(--muted-foreground)",
  "#5f6877": "var(--muted-foreground)",
  "#848e9a": "var(--input)",
  "#8c96a3": "var(--input)",
  "#919dab": "var(--input)",
  "#9ea5ad": "var(--input)",
  "#a2abb5": "var(--input)",
  "#b7bdc5": "var(--input)",
  "#bdc0ce": "var(--input)",
  "#bdc2cd": "var(--input)",
  "#c8ccd2": "var(--border)",
  "#d6dae2": "var(--border)",
  "#d7dbe0": "var(--border)",
  "#e4e6e9": "var(--border)",
  "#e1e3e8": "var(--accent)",
  "#e0e4ec": "var(--accent)",
  "#e8eaf0": "var(--accent)",
  "#e9eaef": "var(--accent)",
  "#f0f2f5": "var(--secondary)",
  "#f4f6f8": "var(--secondary)",
  "#f8f9fb": "var(--secondary)",
  "#f8f8fa": "var(--secondary)",
  "#f4f4f6": "var(--muted)",
  "#ffffff": "var(--card)",
  "#fff": "var(--card)",
}

const [, , file, id, componentName] = process.argv

if (!file || !id || !componentName) {
  console.error(
    "usage: node scripts/pen-art-to-svg.mjs <pen file> <node id> <ComponentName>"
  )
  process.exit(1)
}

if (!/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
  console.error(
    `component name must be a PascalCase identifier, got ${componentName}`
  )
  process.exit(1)
}

function find(node, want) {
  if (node.id === want) return node
  for (const child of node.children ?? []) {
    const found = find(child, want)
    if (found) return found
  }
  return null
}

function colour(value, where) {
  if (value == null || value === "transparent" || value === "none")
    return "none"
  if (typeof value !== "string") {
    throw new Error(`unmapped colour ${JSON.stringify(value)} on ${where}`)
  }
  const key = value.trim().toLowerCase()
  if (key === "#00000000") return "none"
  const mapped = COLOUR[key]
  if (!mapped) throw new Error(`unmapped colour ${value} on ${where}`)
  return mapped
}

function num(value, where) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`expected a finite number on ${where}, got ${value}`)
  }
  const rounded = Math.round(value * 1e6) / 1e6
  return JSON.stringify(Object.is(rounded, -0) ? 0 : rounded)
}

function quote(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
}

function strokeAttrs(node, where) {
  const stroke = colour(node.stroke, where)
  if (stroke === "none") return []
  if (node.strokeWidth == null) {
    throw new Error(`${where} has a stroke and no strokeWidth`)
  }
  const attrs = [
    `stroke="${stroke}"`,
    `strokeWidth={${num(node.strokeWidth, where)}}`,
  ]
  if (node.strokeLinecap)
    attrs.push(`strokeLinecap="${quote(node.strokeLinecap)}"`)
  if (node.strokeLinejoin)
    attrs.push(`strokeLinejoin="${quote(node.strokeLinejoin)}"`)
  return attrs
}

function renderChild(node, index) {
  const where = node.id || `#${index}`
  if (node.type === "path") {
    if (typeof node.geometry !== "string" || node.geometry.length === 0) {
      throw new Error(`path ${where} has no geometry`)
    }
    if (node.rotation) throw new Error(`path ${where} has rotation`)
    if (node.flipX || node.flipY) throw new Error(`path ${where} is flipped`)
    const attrs = [
      `transform="translate(${num(node.x, where)} ${num(node.y, where)})"`,
      `d="${quote(node.geometry)}"`,
      `fill="${colour(node.fill, where)}"`,
      ...strokeAttrs(node, where),
    ]
    return `      <path ${attrs.join(" ")} />`
  }
  if (node.type === "ellipse") {
    const rx = node.width / 2
    const ry = node.height / 2
    // A rotated node is placed by its top-left and spun counter-clockwise
    // around that corner. SVG rotate() is clockwise, so negate the angle and
    // pivot on the corner. An unrotated ellipse stays centred in user space
    // so files with no rotation stay byte-identical.
    const rotated = Boolean(node.rotation)
    const attrs = [
      `cx={${num(rotated ? rx : node.x + rx, where)}}`,
      `cy={${num(rotated ? ry : node.y + ry, where)}}`,
      `rx={${num(rx, where)}}`,
      `ry={${num(ry, where)}}`,
      `fill="${colour(node.fill, where)}"`,
    ]
    if (rotated) {
      attrs.push(
        `transform="translate(${num(node.x, where)} ${num(node.y, where)}) rotate(${num(-node.rotation, where)})"`
      )
    }
    attrs.push(...strokeAttrs(node, where))
    return `      <ellipse ${attrs.join(" ")} />`
  }
  throw new Error(`unsupported ${node.type} (${where}) under ${id}`)
}

const doc = JSON.parse(fs.readFileSync(file, "utf8"))
const node = find(doc, id)
if (!node) {
  console.error(`node ${id} not found in ${file}`)
  process.exit(1)
}

const children = node.children ?? []
if (children.length === 0) {
  console.error(`node ${id} has no children`)
  process.exit(1)
}

let body
try {
  body = children.map(renderChild).join("\n")
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const box = `0 0 ${num(node.width, `${id} width`)} ${num(node.height, `${id} height`)}`
const source = `// Generated by scripts/pen-art-to-svg.mjs from opencv.pen node ${id}. Do not edit by hand.
export function ${componentName}() {
  return (
    <svg viewBox="${box}" aria-hidden="true">
${body}
    </svg>
  )
}
`

// Format with the repo's prettier so regenerated art passes the format check unchanged.
const prettier = await import("prettier")
const options =
  (await prettier.resolveConfig(
    "apps/web/src/features/landing/figures/art.tsx"
  )) ?? {}
process.stdout.write(
  await prettier.format(source, { ...options, parser: "typescript" })
)
