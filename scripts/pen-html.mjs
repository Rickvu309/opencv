import { join } from "node:path"

const LUCIDE = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "file-text":
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  "badge-check":
    '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  linkedin:
    '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 4"/>',
}

const JUSTIFY = {
  center: "center",
  space_between: "space-between",
  end: "flex-end",
  flex_end: "flex-end",
  start: "flex-start",
}
const ALIGN = {
  center: "center",
  end: "flex-end",
  flex_end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
}
const NAMED_WEIGHT = { normal: 400, bold: 700 }

const escapeHtml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const findDescendant = (node, id) => {
  for (const child of node.children ?? []) {
    if (child.id === id) return child
    const hit = findDescendant(child, id)
    if (hit) return hit
  }
  return null
}

export const findPenNode = (doc, id) => {
  for (const top of doc.children) {
    if (top.id === id) return top
    const hit = findDescendant(top, id)
    if (hit) return hit
  }
  return null
}

const resolvePath = (root, path) => {
  let node = root
  for (const id of path) {
    node = findDescendant(node, id)
    if (!node) return null
  }
  return node
}

export function expandPenRefs(doc, node) {
  const expandChildren = (parent) => {
    if (!parent.children) return parent
    parent.children = parent.children.map((child) => expandPenRefs(doc, child))
    return parent
  }
  if (node.type !== "ref") return expandChildren(structuredClone(node))
  const source = findPenNode(doc, node.ref)
  if (!source) throw new Error(`pen ref ${node.ref} points at no node`)
  const { descendants = {}, ref, type, ...own } = node
  const component = expandChildren(structuredClone(source))
  Object.assign(component, own)
  delete component.reusable
  for (const [key, patch] of Object.entries(descendants)) {
    const path = key.split("/")
    const target =
      resolvePath(component, path) ??
      findDescendant(component, path[path.length - 1])
    if (target) Object.assign(target, structuredClone(patch))
  }
  return expandChildren(component)
}

const resolveColor = (variables, value) => {
  if (typeof value !== "string") return value
  if (!value.startsWith("$")) return value
  const variable = variables[value.slice(1)]
  if (!variable) throw new Error(`pen variable ${value} is not defined`)
  return resolveColor(variables, variable.value)
}

const asList = (value) => (Array.isArray(value) ? value : [value])

const gradientCss = (fill, color) => {
  const stops = fill.colors
    .map((stop) => `${color(stop.color)} ${stop.position * 100}%`)
    .join(",")
  if (fill.gradientType === "radial") {
    const rx = ((fill.size?.width ?? 1) * 50).toFixed(2)
    const ry = ((fill.size?.height ?? 1) * 50).toFixed(2)
    const cx = ((fill.center?.x ?? 0.5) * 100).toFixed(2)
    const cy = ((fill.center?.y ?? 0.5) * 100).toFixed(2)
    return `radial-gradient(${rx}% ${ry}% at ${cx}% ${cy}%,${stops})`
  }
  return `linear-gradient(${fill.rotation ?? 180}deg,${stops})`
}

const fillCss = (fill, ctx) => {
  const color = (value) => resolveColor(ctx.variables, value)
  const layers = []
  let base = null
  for (const entry of asList(fill).filter(Boolean)) {
    if (typeof entry === "string") base = color(entry)
    else if (entry.enabled === false) continue
    else if (entry.type === "image") {
      const url = /^https?:/.test(entry.url)
        ? entry.url
        : `file://${join(ctx.assetBase, entry.url)}`
      layers.push(
        `url('${url}') center/${entry.mode === "fit" ? "contain" : "cover"} no-repeat`
      )
    } else if (entry.type === "mesh_gradient") {
      entry.colors.forEach((stop, index) => {
        const [px, py] = entry.points[index]
        layers.push(
          `radial-gradient(circle at ${px * 100}% ${py * 100}%,${color(stop)} 0%,${color(stop)}00 55%)`
        )
      })
      base = color(entry.colors[4] ?? entry.colors[0])
    } else if (entry.type === "gradient") layers.push(gradientCss(entry, color))
    else if (entry.color) base = color(entry.color)
  }
  if (layers.length)
    return `background:${layers.join(",")}${base ? `,${base}` : ""};`
  return base ? `background:${base};` : ""
}

const paddingCss = (padding) => {
  if (padding == null) return ""
  const list = asList(padding)
  const [top, right, bottom, left] =
    list.length === 1
      ? [list[0], list[0], list[0], list[0]]
      : list.length === 2
        ? [list[0], list[1], list[0], list[1]]
        : list
  return `padding:${top}px ${right}px ${bottom}px ${left}px;`
}

const strokeColor = (stroke, ctx) =>
  resolveColor(
    ctx.variables,
    typeof stroke === "string" ? stroke : (stroke.fill ?? "#000")
  )

const strokeCss = (node, ctx) => {
  if (!node.stroke || node.strokeWidth === 0) return ""
  const color = strokeColor(node.stroke, ctx)
  const width = node.strokeWidth ?? 1
  if (typeof width === "object") {
    const side = (name) => `${width[name] ?? 0}px`
    return `border-style:solid;border-color:${color};border-width:${side("top")} ${side("right")} ${side("bottom")} ${side("left")};`
  }
  if (node.type === "frame" && node.strokeAlignment !== "outside")
    return `border:${width}px solid ${color};`
  return `box-shadow:0 0 0 ${width}px ${color};`
}

const shadowCss = (node, ctx) => {
  const shadows = asList(node.effect ?? [])
    .filter((effect) => effect.type === "shadow")
    .map(
      (effect) =>
        `${effect.shadowType === "inner" ? "inset " : ""}${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.blur ?? 0}px ${effect.spread ?? 0}px ${resolveColor(ctx.variables, effect.color)}`
    )
  return shadows.length ? `box-shadow:${shadows.join(",")};` : ""
}

const sizeCss = (node, parentMode) => {
  const out = []
  for (const [key, css] of [
    ["width", "width"],
    ["height", "height"],
  ]) {
    const value = node[key]
    if (value == null) continue
    if (value === "fill_container") {
      if (parentMode === "abs") out.push(`${css}:100%;`)
      else if ((key === "width") === (parentMode === "row"))
        out.push(`flex:1 1 0;min-${css}:0;`)
      else out.push("align-self:stretch;")
    } else if (value === "fit_content") out.push(`${css}:auto;`)
    else if (typeof value === "number")
      out.push(`${css}:${value}px;flex-shrink:0;`)
  }
  return out.join("")
}

const textNodeHtml = (node, style, ctx) => {
  const weight = NAMED_WEIGHT[node.fontWeight] ?? Number(node.fontWeight ?? 400)
  const fixed = node.textGrowth === "fixed-width"
  const css = [
    style,
    `font-family:'${node.fontFamily ?? "Inter"}',Inter,sans-serif;`,
    `font-size:${node.fontSize ?? 14}px;font-weight:${weight};`,
    `line-height:${node.lineHeight ?? 1.2};`,
    `color:${resolveColor(ctx.variables, node.fill ?? "#000")};`,
    node.letterSpacing ? `letter-spacing:${node.letterSpacing}px;` : "",
    `text-align:${node.textAlign ?? "left"};`,
    `white-space:${fixed ? "pre-wrap" : "pre"};`,
    fixed ? "overflow-wrap:break-word;" : "",
  ].join("")
  return `<div data-id="${node.id}" data-pen-text style="${css}">${escapeHtml(node.content ?? "")}</div>`
}

const iconHtml = (node, ctx) => {
  const width = node.width ?? 16
  const height = node.height ?? 16
  const color = resolveColor(ctx.variables, node.fill ?? "#000")
  const body =
    LUCIDE[node.icon] ?? '<rect x="5" y="5" width="14" height="14" rx="3"/>'
  return `<svg viewBox="0 0 24 24" width="${width}" height="${height}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${body}</svg>`
}

const svgGradient = (id, fill, ctx) => {
  const angle = ((fill.rotation ?? 180) * Math.PI) / 180
  const dx = Math.sin(angle) / 2
  const dy = -Math.cos(angle) / 2
  const stops = fill.colors
    .map(
      (stop) =>
        `<stop offset="${stop.position}" stop-color="${resolveColor(ctx.variables, stop.color)}"/>`
    )
    .join("")
  return `<defs><linearGradient id="${id}" x1="${0.5 - dx}" y1="${0.5 - dy}" x2="${0.5 + dx}" y2="${0.5 + dy}">${stops}</linearGradient></defs>`
}

const pathHtml = (node, ctx) => {
  const box = node.viewBox ?? [0, 0, node.width ?? 24, node.height ?? 24]
  const entry = node.fill ? asList(node.fill)[0] : null
  const gradient = entry && typeof entry === "object" && entry.colors
  const defs = gradient ? svgGradient(`fill-${node.id}`, entry, ctx) : ""
  const fill = !entry
    ? "none"
    : gradient
      ? `url(#fill-${node.id})`
      : resolveColor(
          ctx.variables,
          typeof entry === "string" ? entry : entry.color
        )
  const stroke = node.stroke
    ? `stroke="${strokeColor(node.stroke, ctx)}" stroke-width="${node.strokeWidth ?? 1}" stroke-linecap="${node.strokeLinecap ?? "butt"}" stroke-linejoin="${node.strokeLinejoin ?? "miter"}"`
    : ""
  return `<svg viewBox="${box.join(" ")}" width="${node.width ?? box[2]}" height="${node.height ?? box[3]}" preserveAspectRatio="none" style="display:block;overflow:visible">${defs}<path d="${node.geometry}" fill="${fill}" fill-rule="${node.fillRule ?? "nonzero"}" ${stroke}/></svg>`
}

const sweepHtml = (node, ctx) => {
  const angle = (node.sweepAngle * Math.PI) / 180
  const x = 0.5 + 0.5 * Math.cos(angle)
  const y = 0.5 + 0.5 * Math.sin(angle)
  const fill = resolveColor(ctx.variables, asList(node.fill)[0])
  return `<svg viewBox="0 0 1 1" width="${node.width ?? 10}" height="${node.height ?? 10}" preserveAspectRatio="none" style="display:block"><path d="M.5 .5 L1 .5 A.5 .5 0 ${node.sweepAngle > 180 ? 1 : 0} 1 ${x} ${y}Z" fill="${fill}"/></svg>`
}

const parentModeOf = (parent) => {
  if (!parent) return "abs"
  if (parent.layout === "none") return "abs"
  return parent.layout === "vertical" ? "col" : "row"
}

const containerCss = (node, ctx) => {
  const out = []
  if (node.type !== "ellipse" || !node.sweepAngle)
    out.push(node.fill ? fillCss(node.fill, ctx) : "")
  if (node.type === "frame") {
    if (node.layout === "none") out.push("display:block;")
    else
      out.push(
        `display:flex;flex-direction:${node.layout === "vertical" ? "column" : "row"};`
      )
    if (node.gap != null) out.push(`gap:${node.gap}px;`)
    if (node.justifyContent)
      out.push(
        `justify-content:${JUSTIFY[node.justifyContent] ?? "flex-start"};`
      )
    if (node.alignItems)
      out.push(`align-items:${ALIGN[node.alignItems] ?? "flex-start"};`)
    else if (node.layout !== "none") out.push("align-items:flex-start;")
    out.push(paddingCss(node.padding))
    if (node.clip) out.push("overflow:hidden;")
  }
  if (node.type === "ellipse") out.push("border-radius:50%;")
  if (node.cornerRadius != null)
    out.push(
      `border-radius:${asList(node.cornerRadius)
        .map((radius) => `${radius}px`)
        .join(" ")};`
    )
  out.push(strokeCss(node, ctx), shadowCss(node, ctx))
  return out.join("")
}

export function penNodeToHtml(node, parent, ctx) {
  if (node.enabled === false) return ""
  const mode = node.layoutPosition === "absolute" ? "abs" : parentModeOf(parent)
  const style = [
    "box-sizing:border-box;",
    sizeCss(node, mode),
    mode === "abs"
      ? `position:absolute;left:${node.x ?? 0}px;top:${node.y ?? 0}px;`
      : "position:relative;",
    node.rotation ? `transform:rotate(${-node.rotation}deg);` : "",
    node.opacity != null ? `opacity:${node.opacity};` : "",
  ].join("")
  if (node.type === "text") return textNodeHtml(node, style, ctx)
  const wrap = (css, inner, tag = "") =>
    `<div data-id="${node.id}"${tag} style="${style}${css}">${inner}</div>`
  if (node.type === "icon")
    return wrap(
      "",
      iconHtml(node, ctx),
      ` data-pen-icon="${escapeHtml(node.icon ?? "")}"`
    )
  if (node.type === "path")
    return node.geometry ? wrap("", pathHtml(node, ctx)) : ""
  if (["frame", "rectangle", "ellipse"].includes(node.type)) {
    const inner =
      node.type === "ellipse" && node.sweepAngle
        ? sweepHtml(node, ctx)
        : (node.children ?? [])
            .map((child) => penNodeToHtml(child, node, ctx))
            .join("")
    const drawn = node.type !== "ellipse" && strokeCss(node, ctx) !== ""
    return wrap(
      containerCss(node, ctx),
      inner,
      drawn ? ` data-pen-box="${escapeHtml(node.name ?? "")}"` : ""
    )
  }
  return ""
}

function withNumbers(variables, value) {
  if (typeof value === "string" && value.startsWith("$")) {
    const variable = variables[value.slice(1)]
    const resolved =
      variable && typeof variable === "object" ? variable.value : variable
    return typeof resolved === "number" ||
      (typeof resolved === "string" && resolved.startsWith("$"))
      ? withNumbers(variables, resolved)
      : value
  }
  if (Array.isArray(value))
    return value.map((item) => withNumbers(variables, item))
  if (value && typeof value === "object") {
    const out = {}
    for (const [key, item] of Object.entries(value))
      out[key] =
        key === "fill" || key === "stroke" || key === "content"
          ? item
          : withNumbers(variables, item)
    return out
  }
  return value
}

export function penFrameToDocument(doc, frame, { assetBase, fontFace }) {
  const ctx = { variables: doc.variables ?? {}, assetBase }
  const root = withNumbers(ctx.variables, { ...frame, x: 0, y: 0 })
  return `<!doctype html><meta charset="utf-8"><style>${fontFace}*{margin:0}html,body{width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:#fff}</style><body>${penNodeToHtml(root, null, ctx)}`
}
