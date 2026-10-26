// Generates JavaScript for the pencil `execute` tool. Every snippet is self-contained and
// prints the ids it created, so an agent can chain the next call.

const q = (s) => JSON.stringify(s)

export function meshFill(palette) {
  const [cx, cy] = palette.center
  return {
    type: "mesh_gradient",
    columns: 3,
    rows: 3,
    colors: palette.colors,
    points: [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [0, 0.5],
      [cx, cy],
      [1, 0.5],
      [0, 1],
      [0.5, 1],
      [1, 1],
    ],
  }
}

function placement(opts, w, h) {
  if (opts.parent && opts.parent !== "document")
    return { parent: q(opts.parent), pos: "" }
  if (opts.x != null && opts.y != null)
    return {
      parent: "document",
      pos: `, x: ${Number(opts.x)}, y: ${Number(opts.y)}`,
    }
  return {
    parent: "document",
    pos: ", x: pos.x, y: pos.y",
    pre: `const pos = FindEmptySpace({ width: ${w || 400}, height: ${h || 200}, padding: 120 });\n`,
  }
}

// text overrides: { "Label": "Add job" } keyed by text node name, content or index ("1").
export function resolveOverrides(variant, texts = {}, icons = {}) {
  const out = []
  const used = new Set()
  for (const [key, value] of Object.entries(texts)) {
    const t = /^\d+$/.test(key)
      ? variant.texts[Number(key) - 1]
      : variant.texts.find(
          (x) =>
            !used.has(x.id) &&
            (x.name.toLowerCase() === key.toLowerCase() ||
              x.content.toLowerCase() === key.toLowerCase())
        )
    if (!t)
      throw new Error(
        `No text "${key}" in ${variant.name}. Texts: ${variant.texts.map((x) => x.name || x.content).join(", ") || "none"}`
      )
    used.add(t.id)
    out.push({ id: t.id, props: { content: value } })
  }
  for (const [key, value] of Object.entries(icons)) {
    const i = /^\d+$/.test(key)
      ? variant.icons[Number(key) - 1]
      : variant.icons.find(
          (x) => x.name.toLowerCase() === key.toLowerCase() || x.icon === key
        )
    if (!i)
      throw new Error(
        `No icon "${key}" in ${variant.name}. Icons: ${variant.icons.map((x) => x.name || x.icon).join(", ") || "none"}`
      )
    out.push({ id: i.id, props: { icon: value } })
  }
  return out
}

export function instanceSnippet(variant, opts = {}) {
  const v = opts.var || "node"
  const p = placement(
    opts,
    typeof variant.width === "number" ? variant.width : 320,
    typeof variant.height === "number" ? variant.height : 120
  )
  const props = { type: "ref", ref: variant.id }
  if (opts.name) props.name = opts.name
  if (opts.width)
    props.width = /^\d+$/.test(opts.width) ? Number(opts.width) : opts.width
  const overrides = resolveOverrides(variant, opts.texts, opts.icons)
  const lines = [`// opencv: ${variant.name} (${variant.id})`]
  if (p.pre) lines.push(p.pre.trimEnd())
  lines.push(
    `const ${v} = Insert(${p.parent}, ${q(props).replace(/}$/, p.pos + " }")});`
  )
  for (const o of overrides)
    lines.push(`Update(${v} + "/${o.id}", ${q(o.props)});`)
  lines.push(`Print(${q(variant.name + ": ")} + ${v});`)
  return lines.join("\n")
}

const MARK = `const mark = (p, size, color) => { const k = size / 24; const m = Insert(p, { type: "frame", name: "Mark", width: size, height: size, layout: "none" }); Insert(m, { type: "rectangle", name: "Frame", x: 2 * k, y: 2 * k, width: 20 * k, height: 20 * k, fill: "#00000000", stroke: color, strokeWidth: 2.4 * k, strokeAlignment: "inner" }); const cl = Insert(m, { type: "frame", name: "Clip", x: 2 * k, y: 2 * k, width: 20 * k, height: 20 * k, clip: true, layout: "none", fill: "#00000000" }); Insert(cl, { type: "ellipse", name: "Quadrant", x: -14 * k, y: 6 * k, width: 28 * k, height: 28 * k, sweepAngle: 90, fill: color }); return m; };`

export function brandSnippet(opts = {}) {
  const size = Number(opts.size || 26)
  const lead = opts.lead ?? "Welcome to"
  const color = opts.color || "#1A1A1A"
  const p = placement(opts, 400, size * 2)
  return [
    `// opencv brand heading: "${lead} [mark] opencv"`,
    MARK,
    p.pre ? p.pre.trimEnd() : "",
    `const brand = Insert(${p.parent}, { type: "frame", name: "Brand heading", gap: ${Math.round(size * 0.28)}, alignItems: "center"${p.pos} });`,
    lead
      ? `Insert(brand, { type: "text", name: "Lead", content: ${q(lead)}, fontFamily: "Inter", fontSize: ${size}, fontWeight: "600", letterSpacing: ${-(size * 0.027).toFixed(2)}, fill: ${q(color)} });`
      : "",
    `mark(brand, ${Math.round(size * 0.92)}, ${q(color)});`,
    `Insert(brand, { type: "text", name: "Wordmark", content: "opencv", fontFamily: "Inter", fontSize: ${size}, fontWeight: "600", letterSpacing: ${-(size * 0.035).toFixed(2)}, fill: ${q(color)} });`,
    'Print("brand: " + brand);',
  ]
    .filter(Boolean)
    .join("\n")
}

export function glowSnippet(name, palette, opts = {}) {
  const fill = meshFill(palette)
  const w = Number(opts.width || 1344)
  const h = Number(opts.height || 760)
  const p = placement(opts, w, h)
  const lines = [`// opencv glow "${name}": ${palette.use}`]
  if (p.pre) lines.push(p.pre.trimEnd())
  lines.push(
    `const glow = Insert(${p.parent}, { type: "frame", name: ${q("Glow " + name)}, width: ${w}, height: ${h}, cornerRadius: 16, clip: true, layout: "vertical", alignItems: "center", padding: [64, 64, 0, 64], stroke: "$l-line", strokeWidth: 1, fill: ${q(fill)}${p.pos} });`
  )
  if (opts.image) {
    const sw = w - 128
    lines.push(`// screenshot keeps 16:10 and bleeds off the bottom only`)
    lines.push(
      `Insert(glow, { type: "frame", name: "Screen", width: ${sw}, height: ${Math.round(sw / 1.6)}, cornerRadius: 12, clip: true, stroke: "#FFFFFFB3", strokeWidth: 1, fill: { type: "image", url: ${q(opts.image)}, mode: "cover" }, effect: [{ type: "shadow", shadowType: "outer", offset: { x: 0, y: 24 }, blur: 64, color: "#1B1F2E2E" }] });`
    )
  }
  lines.push('Print("glow: " + glow);')
  return lines.join("\n")
}
