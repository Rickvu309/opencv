export const DESIGN_BRANCH = "chore/350-design-kit-cli-skills"
export const PEN_IN_BRANCH = "design/opencv.pen"
const CHILD_LIMIT = 40

export function penPath({ flag, env, fallback, exists }) {
  for (const candidate of [flag, env.OCV_PEN, fallback])
    if (candidate && exists(candidate)) return { path: candidate }
  return {
    missing: [flag, env.OCV_PEN, fallback].filter(Boolean),
    fetch: `git fetch origin ${DESIGN_BRANCH} && git show origin/${DESIGN_BRANCH}:${PEN_IN_BRANCH} > ${fallback}`,
  }
}

export function indexPen(doc) {
  const nodes = new Map()
  const visit = (node, parent, container) => {
    if (!node || typeof node !== "object") return
    if (typeof node.id === "string")
      nodes.set(node.id, { node, parent, container })
    const own = node.id ?? parent
    for (const child of node.children ?? []) visit(child, own, { node })
    for (const [key, override] of Object.entries(node.descendants ?? {})) {
      if (!override || typeof override !== "object") continue
      if (typeof override.id === "string") visit(override, own, null)
      else
        for (const child of override.children ?? [])
          visit(child, own, { overrides: key, node: override })
    }
  }
  for (const child of doc.children ?? []) visit(child, null, null)
  return nodes
}

export function findFrames(index, query) {
  if (index.has(query)) return [query]
  return [...index.entries()]
    .filter(([, { node }]) => node.name === query)
    .map(([id]) => id)
}

export function boxSides(padding) {
  if (padding === undefined) return [0, 0, 0, 0]
  if (typeof padding === "number") return [padding, padding, padding, padding]
  if (!Array.isArray(padding)) return [null, null, null, null]
  if (padding.length === 1) return boxSides(padding[0])
  if (padding.length === 2)
    return [padding[0], padding[1], padding[0], padding[1]]
  if (padding.length === 3)
    return [padding[0], padding[1], padding[2], padding[1]]
  return padding.slice(0, 4)
}

const number = (value) => (typeof value === "number" ? value : null)

function resolved(index, node) {
  const master = node.type === "ref" ? index.get(node.ref)?.node : null
  return master ? { ...master, ...node, children: master.children } : node
}

function containerNode(index, entry) {
  const container = entry?.container
  if (!container) return null
  if (!container.overrides) return resolved(index, container.node)
  const base = index.get(container.overrides)?.node ?? {}
  return { ...resolved(index, base), ...container.node }
}

const shown = (child) => child && child.id && child.enabled !== false

export function hugSize(index, node, axis) {
  const fixed = number(node[axis])
  if (fixed !== null) return fixed
  if (node.type === "icon" || node.type === "text") return null
  const full = resolved(index, node)
  const children = (full.children ?? []).filter(shown)
  if (children.length === 0) return null
  const sizes = children.map((child) => hugSize(index, child, axis))
  if (sizes.some((size) => size === null)) return null
  const [top, right, bottom, left] = boxSides(full.padding)
  const along =
    (full.layout ?? "horizontal") ===
    (axis === "height" ? "vertical" : "horizontal")
  const inner = along
    ? sizes.reduce((sum, size) => sum + size, 0) +
      (full.gap ?? 0) * (sizes.length - 1)
    : Math.max(...sizes)
  return axis === "height" ? inner + top + bottom : inner + left + right
}

function layoutOffsets(index, id, entry) {
  const parent = containerNode(index, entry)
  if (!parent) return {}
  const vertical = (parent.layout ?? "horizontal") === "vertical"
  const across = vertical ? parent.alignItems : parent.justifyContent
  const centered = across === "center" ? { centerOffset: 0 } : {}
  if (!vertical) return centered
  const [, , , paddingLeft] = boxSides(parent.padding)
  const siblings = (parent.children ?? []).filter(shown)
  const at = siblings.findIndex((child) => child.id === id)
  return {
    left:
      parent.alignItems && parent.alignItems !== "start" ? null : paddingLeft,
    below: at > 0 ? (parent.gap ?? 0) : null,
    ...centered,
  }
}

export function frameGeometry(index, id) {
  const entry = index.get(id)
  if (!entry) return null
  const instance = entry.node
  const master = instance.type === "ref" ? index.get(instance.ref)?.node : null
  const node = resolved(index, instance)
  const [paddingTop, paddingRight, paddingBottom, paddingLeft] = boxSides(
    node.padding
  )
  const children = (node.children ?? []).filter((child) => child && child.id)
  const layout = node.layout ?? "horizontal"
  const firstWidth = children.length
    ? hugSize(index, children[0], "width")
    : null
  const offsets = layoutOffsets(index, id, entry)
  return {
    id,
    name: instance.name ?? null,
    type: instance.type,
    ref: master ? instance.ref : null,
    parent: entry.parent,
    width:
      number(node.width) ?? hugSize(index, node, "width") ?? node.width ?? null,
    height:
      number(node.height) ??
      hugSize(index, node, "height") ??
      node.height ??
      null,
    x: number(instance.x),
    y: number(instance.y),
    radius: node.cornerRadius ?? 0,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    gap: node.gap ?? 0,
    fontSize: number(node.fontSize),
    pitch:
      layout === "horizontal" && firstWidth !== null && children.length > 1
        ? firstWidth + (node.gap ?? 0)
        : null,
    left: offsets.left ?? null,
    below: offsets.below ?? null,
    centerOffset: offsets.centerOffset ?? null,
    layout,
    children: children.slice(0, CHILD_LIMIT).map((child) => ({
      id: child.id,
      name: child.name ?? null,
      type: child.type,
      width: child.width ?? null,
      height: child.height ?? null,
    })),
    moreChildren: Math.max(0, children.length - CHILD_LIMIT),
  }
}

export function frameChain(index, id) {
  const chain = []
  for (let at = id; at && index.has(at); at = index.get(at).parent)
    chain.unshift({ id: at, node: index.get(at).node })
  return chain
}

const nodeLabel = ({ node }) =>
  node.type === "ref"
    ? `${node.name ?? node.id} (instance)`
    : (node.name ?? node.id)

const joinPath = (chain) => chain.map(nodeLabel).join(" > ")

export function framePath(index, id) {
  return joinPath(frameChain(index, id))
}

export function composedPlacement(index, { frame, composedScreen, via }) {
  let chain = frameChain(index, frame)
  if (chain.length === 0) return { inScreen: false, path: null }
  const inScreen = (links) =>
    links.some(({ node }) => node.name === composedScreen)
  const fromScreen = (links) =>
    links.slice(links.findIndex(({ node }) => node.name === composedScreen))
  if (inScreen(chain))
    return { inScreen: true, path: joinPath(fromScreen(chain)) }
  for (const instance of [via ?? []].flat().reverse()) {
    const outer = frameChain(index, instance)
    const master = outer.at(-1)?.node.ref
    const inMaster = chain.findIndex(({ id }) => id === master)
    if (inMaster === -1) return { inScreen: false, path: joinPath(chain) }
    chain = [...outer, ...chain.slice(inMaster + 1)]
  }
  if (via && inScreen(chain))
    return { inScreen: true, path: joinPath(fromScreen(chain)) }
  return { inScreen: false, path: joinPath(frameChain(index, frame)) }
}
